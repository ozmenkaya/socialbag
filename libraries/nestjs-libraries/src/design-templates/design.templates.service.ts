import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { OverlayOptions } from 'sharp';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { DesignSize, MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { MediaAutoPostService } from '@gitroom/nestjs-libraries/database/prisma/media/media.autopost.service';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import { ProjectBrand } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.repository';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';

export const DESIGN_TEMPLATES = {
  classic:
    'one photo full size, the headline and subline over a fade into the brand color at the bottom, logo at the top, contact strip',
  panel:
    'one photo on top (left on landscape), a brand color panel under it with the headline, subline and contact',
  frame:
    'one photo framed by the brand color, the headline in a white label over the photo, logo and contact under it',
  badge:
    'one photo full size with a round badge in the accent color holding the badge text, headline at the bottom',
  collage:
    '2 to 4 photos in a grid with a brand color strip holding the logo, headline and subline',
} as const;

export type DesignTemplate = keyof typeof DESIGN_TEMPLATES;

export interface TemplateDesignParams {
  template: DesignTemplate;
  mediaIds: string[];
  size: DesignSize;
  headline: string;
  subline?: string;
  badge?: string;
  contact?: string;
  projectId?: string;
  // replace the colors of the brand for this design only
  primary?: string;
  accent?: string;
  folderId?: string;
}

const SIZES: Record<DesignSize, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

// bundled with the code, the server has no fonts with every Turkish letter
const FONTS = {
  modern: {
    headline: { file: 'Montserrat-Bold.ttf', name: 'Montserrat Bold' },
    body: { file: 'Montserrat-Regular.ttf', name: 'Montserrat' },
    label: { file: 'Montserrat-SemiBold.ttf', name: 'Montserrat SemiBold' },
  },
  elegant: {
    headline: { file: 'PlayfairDisplay.ttf', name: 'Playfair Display Bold' },
    body: { file: 'Montserrat-Regular.ttf', name: 'Montserrat' },
    label: { file: 'Montserrat-SemiBold.ttf', name: 'Montserrat SemiBold' },
  },
};

type Font = (typeof FONTS)['modern']['headline'];

const DEFAULT_PRIMARY = '#1F2A44';
const DEFAULT_ACCENT = '#C9A227';

// the source folder, from the compiled code as well (tsc does not copy fonts)
const fontsDir = (() => {
  let dir = __dirname;
  while (true) {
    for (const candidate of [
      join(dir, 'fonts'),
      join(dir, 'libraries/nestjs-libraries/src/design-templates/fonts'),
    ]) {
      if (existsSync(join(candidate, FONTS.modern.headline.file))) {
        return candidate;
      }
    }
    if (dirname(dir) === dir) {
      return join(__dirname, 'fonts');
    }
    dir = dirname(dir);
  }
})();

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// readable text on a background
const onColor = (hex: string) => (luminance(hex) > 0.55 ? '#111111' : '#FFFFFF');

const svg = (width: number, height: number, body: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`
  );

const rect = (width: number, height: number, color: string, radius = 0) =>
  svg(width, height, `<rect width="${width}" height="${height}" rx="${radius}" fill="${color}"/>`);

// stops: [offset, opacity] from top to bottom
const fade = (width: number, height: number, color: string, stops: [number, number][]) =>
  svg(
    width,
    height,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops
      .map(
        ([offset, opacity]) =>
          `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`
      )
      .join('')}</linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>`
  );

interface Rendered {
  data: Buffer;
  width: number;
  height: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

@Injectable()
export class DesignTemplatesService {
  private storage = UploadFactory.createStorage();

  constructor(
    private _mediaService: MediaService,
    private _mediaAutoPostService: MediaAutoPostService,
    private _projectsService: ProjectsService
  ) {}

  // renders the design, saves it in the media library and returns it with the
  // picture so the agent can look at it
  async design(org: string, params: TemplateDesignParams) {
    const photos = params.template === 'collage' ? 4 : 1;
    if (params.template === 'collage' && params.mediaIds.length < 2) {
      throw new BadRequestException('The collage template needs 2 to 4 photos');
    }

    const brand: ProjectBrand = params.projectId
      ? await this._projectsService.getBrand(org, params.projectId)
      : {};
    const photoBuffers = await this._mediaService.getMediaPictures(
      org,
      params.mediaIds.slice(0, photos)
    );
    // a logo deleted from the library since is left out of the design
    const [logo] = brand.logoId
      ? await this._mediaService.getMediaByIds(org, [brand.logoId])
      : [];

    const image = await this.render(params, {
      photos: photoBuffers,
      logo: logo ? (await this._mediaService.getMediaPictures(org, [logo.id]))[0] : undefined,
      primary: params.primary || brand.primary || DEFAULT_PRIMARY,
      accent: params.accent || brand.accent || DEFAULT_ACCENT,
      font: brand.font || 'modern',
      contact: params.contact ?? brand.contact,
    });

    const file = await this.storage.uploadSimple(
      'data:image/jpeg;base64,' + image.toString('base64')
    );
    const saved = await this._mediaService.saveFile(org, file.split('/').pop(), file);
    if (params.folderId) {
      await this._mediaAutoPostService.moveMedia(org, {
        media: [saved.id],
        folderId: params.folderId,
      });
    }

    return { media: saved, image };
  }

  private async render(
    params: TemplateDesignParams,
    look: {
      photos: Buffer[];
      logo?: Buffer;
      primary: string;
      accent: string;
      font: 'modern' | 'elegant';
      contact?: string;
    }
  ) {
    const { width: W, height: H } = SIZES[params.size];
    const tall = H > W * 1.5;
    // a story is seen full screen, everything on it is a bit bigger
    const s = (Math.min(W, H) / 1080) * (tall ? 1.2 : 1);
    const m = Math.round(64 * s);
    const landscape = W > H;
    const fonts = FONTS[look.font];
    const onPrimary = onColor(look.primary);
    const layers: OverlayOptions[] = [];
    const add = (input: Buffer, left: number, top: number) =>
      layers.push({ input, left: Math.round(left), top: Math.round(top) });

    const photo = (index: number, width: number, height: number) =>
      sharp(look.photos[index])
        .rotate()
        .resize(Math.round(width), Math.round(height), {
          fit: 'cover',
          position: sharp.strategy.attention,
        })
        .toBuffer();

    // headline, subline and an accent bar stacked up from the bottom of a box
    const stack = async (
      box: Box,
      color: string,
      align: 'left' | 'centre',
      sizes: { headline: number; subline: number },
      valign: 'bottom' | 'center' = 'bottom'
    ) => {
      const subline = params.subline
        ? await this.text(params.subline, fonts.body, sizes.subline * s, box.width, color, {
            align,
            maxHeight: box.height * 0.3,
          })
        : undefined;
      const headline = await this.text(
        params.headline,
        fonts.headline,
        sizes.headline * s,
        box.width,
        color,
        {
          align,
          maxHeight: box.height - (subline ? subline.height + 24 * s : 0) - 40 * s,
        }
      );
      const x = (r: { width: number }) =>
        align === 'centre' ? box.left + (box.width - r.width) / 2 : box.left;

      const bar = { width: Math.round(90 * s), height: Math.round(8 * s) };
      const total =
        bar.height + 28 * s + headline.height + (subline ? subline.height + 20 * s : 0);
      let y = valign === 'center' ? box.top + (box.height + total) / 2 : box.top + box.height;
      if (subline) {
        y -= subline.height;
        add(subline.data, x(subline), y);
        y -= 20 * s;
      }
      y -= headline.height;
      add(headline.data, x(headline), y);
      add(rect(bar.width, bar.height, look.accent), x(bar), y - 28 * s - bar.height);
    };

    const contactLine = async (box: Box, color: string, align: 'left' | 'centre' | 'right') => {
      if (!look.contact) {
        return;
      }
      // kept on one line
      const text = await this.text(look.contact, fonts.label, 28 * s, box.width, color, {
        align,
        maxHeight: Math.min(box.height, 28 * s * 1.6),
      });
      const left =
        align === 'centre'
          ? box.left + (box.width - text.width) / 2
          : align === 'right'
          ? box.left + box.width - text.width
          : box.left;
      add(text.data, left, box.top + (box.height - text.height) / 2);
    };

    const logo = async (box: Box, background: string | 'photo', align: 'left' | 'right' = 'left') => {
      if (!look.logo) {
        return;
      }
      const placed = await this.logo(look.logo, box.width, box.height, background, s);
      add(placed.data, align === 'right' ? box.left + box.width - placed.width : box.left, box.top);
    };

    const pill = async (right: number, top: number) => {
      if (!params.badge) {
        return;
      }
      const onAccent = onColor(look.accent);
      const text = await this.text(params.badge, fonts.label, 30 * s, W * 0.5, onAccent, {
        maxHeight: 120 * s,
      });
      const width = Math.round(text.width + 48 * s);
      const height = Math.round(text.height + 28 * s);
      add(rect(width, height, look.accent, height / 2), right - width, top);
      add(text.data, right - width + 24 * s, top + 14 * s);
    };

    const strip = Math.round(84 * s);

    switch (params.template) {
      case 'classic': {
        add(await photo(0, W, H), 0, 0);
        add(fade(W, Math.round(H * 0.25), '#000000', [[0, 0.5], [1, 0]]), 0, 0);
        const bottom = look.contact ? strip : 0;
        const fadeTop = Math.round(H * (landscape ? 0.35 : 0.42));
        add(fade(W, H - fadeTop - bottom, look.primary, [[0, 0], [0.55, 0.78], [1, 0.96]]), 0, fadeTop);
        if (bottom) {
          add(rect(W, strip, look.primary), 0, H - strip);
          await contactLine({ left: m, top: H - strip, width: W - 2 * m, height: strip }, onPrimary, 'centre');
        }
        await stack(
          {
            left: m,
            top: fadeTop + 40 * s,
            width: landscape ? W * 0.6 : W - 2 * m,
            height: H - fadeTop - bottom - 40 * s - m * 0.9,
          },
          onPrimary,
          'left',
          { headline: 84, subline: 36 }
        );
        await logo({ left: m, top: m, width: 280 * s, height: 120 * s }, 'photo');
        await pill(W - m, m);
        break;
      }

      case 'panel': {
        const photoBox = landscape
          ? { left: 0, top: 0, width: Math.round(W * 0.58), height: H }
          : { left: 0, top: 0, width: W, height: Math.round(H * 0.6) };
        add(rect(W, H, look.primary), 0, 0);
        add(await photo(0, photoBox.width, photoBox.height), 0, 0);
        const panel = landscape
          ? { left: photoBox.width + m, top: m, width: W - photoBox.width - 2 * m, height: H - 2 * m }
          : { left: m, top: photoBox.height + m * 0.6, width: W - 2 * m, height: H - photoBox.height - m * 1.2 };
        const bottom = look.contact ? 60 * s : 0;
        if (landscape) {
          await logo({ left: panel.left, top: panel.top, width: 300 * s, height: 130 * s }, look.primary);
        } else {
          await logo({ left: m, top: m, width: 280 * s, height: 120 * s }, 'photo');
        }
        await stack(
          {
            left: panel.left,
            top: panel.top + (landscape ? 170 * s : 0),
            width: panel.width,
            height: panel.height - bottom - 24 * s - (landscape ? 170 * s : 0),
          },
          onPrimary,
          'left',
          { headline: landscape ? 64 : 72, subline: 34 },
          'center'
        );
        if (bottom) {
          add(rect(panel.width, Math.max(1, Math.round(2 * s)), look.accent), panel.left, panel.top + panel.height - bottom + 6 * s);
          await contactLine(
            { left: panel.left, top: panel.top + panel.height - bottom + 12 * s, width: panel.width, height: bottom - 12 * s },
            onPrimary,
            'left'
          );
        }
        await pill(landscape ? photoBox.width - m : W - m, m);
        break;
      }

      case 'frame': {
        add(rect(W, H, look.primary), 0, 0);
        const footer = Math.round((look.logo || look.contact ? 150 : 40) * s);
        const photoBox = landscape
          ? { left: m, top: m, width: Math.round(W * 0.6), height: H - 2 * m }
          : { left: m, top: m, width: W - 2 * m, height: H - 2 * m - footer };
        add(await photo(0, photoBox.width, photoBox.height), photoBox.left, photoBox.top);

        // on landscape the label overlaps the photo, the column right of it
        // holds the logo and the contact
        const column = photoBox.left + photoBox.width + m * 0.75;
        const labelWidth = landscape
          ? Math.round(W - m - (photoBox.left + photoBox.width - 140 * s))
          : photoBox.width - 2 * m;
        const pad = Math.round(40 * s);
        const subline = params.subline
          ? await this.text(params.subline, fonts.body, 32 * s, labelWidth - 2 * pad, '#444444', {
              maxHeight: 160 * s,
            })
          : undefined;
        const headline = await this.text(
          params.headline,
          fonts.headline,
          (landscape ? 58 : 64) * s,
          labelWidth - 2 * pad,
          luminance(look.primary) > 0.8 ? '#111111' : look.primary,
          { maxHeight: (landscape ? H * 0.45 : photoBox.height * 0.4) }
        );
        const labelHeight = Math.round(
          pad * 2 + headline.height + (subline ? subline.height + 16 * s : 0) + 22 * s
        );
        const label = landscape
          ? { left: W - m - labelWidth, top: (H - labelHeight) / 2 }
          : { left: photoBox.left + m, top: photoBox.top + photoBox.height - labelHeight - m };
        add(rect(labelWidth, labelHeight, '#FFFFFF', 12 * s), label.left, label.top);
        add(rect(Math.round(70 * s), Math.round(6 * s), look.accent), label.left + pad, label.top + pad);
        add(headline.data, label.left + pad, label.top + pad + 22 * s);
        if (subline) {
          add(subline.data, label.left + pad, label.top + pad + 22 * s + headline.height + 16 * s);
        }

        if (landscape) {
          await logo({ left: column, top: m, width: 300 * s, height: 130 * s }, look.primary);
          await contactLine(
            { left: column, top: H - m - 60 * s, width: W - m - column, height: 60 * s },
            onPrimary,
            'left'
          );
        } else {
          const footerBox = { left: m, top: H - footer, width: W - 2 * m, height: footer - m * 0.4 };
          await logo(
            { left: footerBox.left, top: footerBox.top + (footerBox.height - 110 * s) / 2, width: 260 * s, height: 110 * s },
            look.primary
          );
          await contactLine(
            {
              left: footerBox.left + (look.logo ? 290 * s : 0),
              top: footerBox.top,
              width: footerBox.width - (look.logo ? 290 * s : 0),
              height: footerBox.height,
            },
            onPrimary,
            look.logo ? 'right' : 'left'
          );
        }
        await pill(photoBox.left + photoBox.width - 24 * s, photoBox.top + 24 * s);
        break;
      }

      case 'badge': {
        add(await photo(0, W, H), 0, 0);
        add(fade(W, Math.round(H * 0.25), '#000000', [[0, 0.5], [1, 0]]), 0, 0);
        const fadeTop = Math.round(H * (landscape ? 0.4 : 0.5));
        add(fade(W, H - fadeTop, '#000000', [[0, 0], [0.6, 0.6], [1, 0.82]]), 0, fadeTop);
        const bottom = look.contact ? 70 * s : 0;
        if (bottom) {
          await contactLine({ left: m, top: H - m - bottom + 20 * s, width: W - 2 * m, height: bottom - 20 * s }, '#FFFFFF', 'left');
        }
        await stack(
          {
            left: m,
            top: fadeTop + 40 * s,
            width: landscape ? W * 0.55 : W - 2 * m,
            height: H - fadeTop - 40 * s - m - bottom,
          },
          '#FFFFFF',
          'left',
          { headline: 80, subline: 36 }
        );
        await logo({ left: m, top: m, width: 280 * s, height: 120 * s }, 'photo');

        if (params.badge) {
          const d = Math.round((landscape ? 340 : 320) * s);
          const onAccent = onColor(look.accent);
          const text = await this.text(params.badge, fonts.headline, 54 * s, d * 0.68, onAccent, {
            align: 'centre',
            maxHeight: d * 0.6,
          });
          const cx = W - m - d / 2;
          const cy = (landscape ? m : m + 140 * s) + d / 2;
          add(
            svg(
              d + 8,
              d + 8,
              `<circle cx="${(d + 8) / 2}" cy="${(d + 8) / 2}" r="${d / 2}" fill="${look.accent}"/><circle cx="${(d + 8) / 2}" cy="${(d + 8) / 2}" r="${d / 2 - 14 * s}" fill="none" stroke="${onAccent}" stroke-opacity="0.5" stroke-width="${Math.max(1, 2 * s)}"/>`
            ),
            cx - (d + 8) / 2,
            cy - (d + 8) / 2
          );
          add(text.data, cx - text.width / 2, cy - text.height / 2);
        }
        break;
      }

      case 'collage': {
        add(rect(W, H, look.primary), 0, 0);
        const gap = Math.round(10 * s);
        const stripHeight = Math.round(H * (landscape ? 0.26 : tall ? 0.25 : 0.27));
        const grid = { width: W, height: H - stripHeight };
        const count = look.photos.length;
        const cells: Box[] =
          count === 2
            ? tall
              ? [
                  { left: 0, top: 0, width: W, height: (grid.height - gap) / 2 },
                  { left: 0, top: (grid.height + gap) / 2, width: W, height: (grid.height - gap) / 2 },
                ]
              : [
                  { left: 0, top: 0, width: (W - gap) / 2, height: grid.height },
                  { left: (W + gap) / 2, top: 0, width: (W - gap) / 2, height: grid.height },
                ]
            : count === 3
            ? tall
              ? [
                  { left: 0, top: 0, width: W, height: grid.height * 0.58 },
                  { left: 0, top: grid.height * 0.58 + gap, width: (W - gap) / 2, height: grid.height * 0.42 - gap },
                  { left: (W + gap) / 2, top: grid.height * 0.58 + gap, width: (W - gap) / 2, height: grid.height * 0.42 - gap },
                ]
              : [
                  { left: 0, top: 0, width: W * 0.6, height: grid.height },
                  { left: W * 0.6 + gap, top: 0, width: W * 0.4 - gap, height: (grid.height - gap) / 2 },
                  { left: W * 0.6 + gap, top: (grid.height + gap) / 2, width: W * 0.4 - gap, height: (grid.height - gap) / 2 },
                ]
            : [0, 1, 2, 3].map((i) => ({
                left: i % 2 ? (W + gap) / 2 : 0,
                top: i > 1 ? (grid.height + gap) / 2 : 0,
                width: (W - gap) / 2,
                height: (grid.height - gap) / 2,
              }));
        for (const [index, cell] of cells.entries()) {
          add(await photo(index, cell.width, cell.height), cell.left, cell.top);
        }

        const top = grid.height + m * 0.6;
        const height = stripHeight - m * 1.2;
        const logoWidth = look.logo ? Math.round((landscape ? 300 : 240) * s) : 0;
        await logo({ left: m, top: top + (height - 110 * s) / 2, width: logoWidth, height: 110 * s }, look.primary);
        const textLeft = m + (logoWidth ? logoWidth + 40 * s : 0);
        const textWidth = W - textLeft - m;
        const contactHeight = look.contact ? 44 * s : 0;
        const subline = params.subline
          ? await this.text(params.subline, fonts.body, 32 * s, textWidth, onPrimary, {
              maxHeight: height * 0.3,
            })
          : undefined;
        const headline = await this.text(params.headline, fonts.headline, 60 * s, textWidth, onPrimary, {
          maxHeight: height - contactHeight - (subline ? subline.height + 12 * s : 0),
        });
        const blockHeight =
          headline.height + (subline ? subline.height + 12 * s : 0) + (contactHeight ? contactHeight + 8 * s : 0);
        let y = top + (height - blockHeight) / 2;
        add(headline.data, textLeft, y);
        y += headline.height + 12 * s;
        if (subline) {
          add(subline.data, textLeft, y);
          y += subline.height + 8 * s;
        }
        await contactLine({ left: textLeft, top: y, width: textWidth, height: contactHeight }, onPrimary, 'left');
        await pill(W - m, m);
        break;
      }
    }

    return sharp({ create: { width: W, height: H, channels: 3, background: look.primary } })
      .composite(layers)
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
      .toBuffer();
  }

  // text wrapped in a width, made smaller until it fits maxHeight
  private async text(
    value: string,
    font: Font,
    size: number,
    width: number,
    color: string,
    options: { align?: 'left' | 'centre' | 'right'; maxHeight?: number } = {}
  ): Promise<Rendered> {
    let current = Math.round(size);
    while (true) {
      const { data, info } = await sharp({
        text: {
          text: `<span foreground="${color}">${escape(value.trim())}</span>`,
          font: `${font.name} ${current}`,
          fontfile: join(fontsDir, font.file),
          width: Math.max(1, Math.round(width)),
          align: options.align || 'left',
          wrap: 'word-char',
          rgba: true,
        },
      })
        .png()
        .toBuffer({ resolveWithObject: true });

      if (!options.maxHeight || info.height <= options.maxHeight || current <= 14) {
        return { data, width: info.width, height: info.height };
      }
      current = Math.max(14, Math.floor(current * 0.9));
    }
  }

  // a dark logo over a photo or a panel of its own color gets a light plate
  // behind it, a logo without transparency is shown as it is
  private async logo(input: Buffer, width: number, height: number, background: string, s: number) {
    const pad = Math.round(16 * s);
    const resized = await sharp(input)
      .rotate()
      .resize(Math.round(width - 2 * pad), Math.round(height - 2 * pad), {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    let count = 0;
    let transparent = false;
    const { data, info } = resized;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) {
        transparent = true;
      }
      if (data[i + 3] > 128) {
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        count++;
      }
    }
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();

    const logoLuminance = count ? sum / count : 1;
    const backgroundLuminance = background === 'photo' ? 0.3 : luminance(background);
    const plate = transparent && Math.abs(logoLuminance - backgroundLuminance) < 0.35;
    if (!plate) {
      return { data: png, width: info.width, height: info.height };
    }

    const plateWidth = info.width + 2 * pad;
    const plateHeight = info.height + 2 * pad;
    const data2 = await sharp(rect(plateWidth, plateHeight, logoLuminance < 0.5 ? '#FFFFFF' : '#111111', 10 * s))
      .composite([{ input: png, left: pad, top: pad }])
      .png()
      .toBuffer();
    return { data: data2, width: plateWidth, height: plateHeight };
  }
}
