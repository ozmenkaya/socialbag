import { BadRequestException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import {
  MediaFolderAutoPostDto,
  MoveMediaDto,
} from '@gitroom/nestjs-libraries/dtos/media/media.folder.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lives apart from MediaService: PostsService already depends on MediaService
@Injectable()
export class MediaAutoPostService {
  constructor(
    private _mediaRepository: MediaRepository,
    private _mediaService: MediaService,
    private _postsService: PostsService
  ) {}

  async updateAutoPost(org: string, id: string, body: MediaFolderAutoPostDto) {
    try {
      dayjs().tz(body.timezone);
    } catch (err) {
      throw new BadRequestException('Unknown timezone');
    }
    if (body.enabled && !body.days.length) {
      throw new BadRequestException('Pick at least one day');
    }
    if (!(await this._mediaRepository.getAutoPostFolder(org, id))) {
      throw new BadRequestException('Folder not found');
    }

    return this._mediaRepository.updateFolderAutoPost(org, id, {
      autoPost: body.enabled,
      autoPostDays: JSON.stringify([...new Set(body.days)].sort()),
      autoPostTime: body.time,
      autoPostTimezone: body.timezone,
      autoPostContent: body.content,
    });
  }

  // uploads into a folder go through here too, so both get queued
  async moveMedia(org: string, body: MoveMediaDto) {
    const result = await this._mediaService.moveMedia(org, body);
    if (body.folderId) {
      try {
        await this.queueMedia(org, body.folderId, body.media);
      } catch (err) {
        console.error(`Could not queue media of folder ${body.folderId}:`, err);
      }
    }

    return result;
  }

  // first slot of the schedule strictly after `after`
  private nextSlot(
    days: number[],
    time: string,
    tz: string,
    after: dayjs.Dayjs
  ) {
    let day = after.tz(tz).startOf('day');
    for (let i = 0; i < 400; i++) {
      const slot = dayjs.tz(`${day.format('YYYY-MM-DD')} ${time}`, tz);
      if (days.includes(slot.day()) && slot.isAfter(after)) {
        return slot;
      }
      day = day.add(1, 'day');
    }

    return undefined;
  }

  private content(template: string, fileName?: string | null) {
    const name = (fileName || '').replace(/\.[^.]+$/, '');
    const text = template.replace(/\{name\}/g, name).trim();
    return text
      .split('\n')
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
  }

  private async queueMedia(org: string, folderId: string, mediaIds: string[]) {
    const folder = await this._mediaRepository.getAutoPostFolder(org, folderId);
    const days: number[] = JSON.parse(folder?.autoPostDays || '[]');
    if (!folder?.autoPost || !days.length || !folder.integrations.length) {
      return;
    }

    const found = await this._mediaRepository.getFolderMedia(org, folderId, mediaIds);
    // keep the order the media were added in
    const media = mediaIds
      .map((id) => found.find((p) => p.id === id))
      .filter((p): p is (typeof found)[number] => !!p);

    const last = await this._mediaRepository.getLastQueued(folderId);
    const soon = dayjs().add(5, 'minutes');
    let after =
      last && dayjs(last.publishDate).isAfter(soon) ? dayjs(last.publishDate) : soon;

    for (const item of media) {
      const slot = this.nextSlot(days, folder.autoPostTime, folder.autoPostTimezone, after);
      if (!slot) {
        return;
      }

      // claimed before any draft exists: a media is never drafted twice
      if (!(await this._mediaRepository.claimQueueSlot(folderId, item.id, slot.toDate()))) {
        continue;
      }
      after = slot;

      // one channel at a time, so a channel that fails does not take the rest along
      for (const { integration } of folder.integrations) {
        try {
          await this._postsService.createPost(
            org,
            {
              date: slot.toISOString(),
              order: makeId(10),
              shortLink: false,
              type: 'draft',
              tags: [],
              posts: [
                {
                  settings: {
                    __type: integration.providerIdentifier as any,
                  },
                  group: makeId(10),
                  integration: { id: integration.id },
                  value: [
                    {
                      id: makeId(10),
                      delay: 0,
                      content: this.content(folder.autoPostContent, item.originalName),
                      image: [
                        {
                          id: item.id,
                          path: item.path,
                          ...(item.thumbnail ? { thumbnail: item.thumbnail } : {}),
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            'AUTOPOST'
          );
        } catch (err) {
          console.error(
            `Could not draft media ${item.id} on channel ${integration.id}:`,
            err
          );
        }
      }
    }
  }
}
