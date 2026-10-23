import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import sharp from 'sharp';
import { ProjectsRepository } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.repository';
import { ProjectDto } from '@gitroom/nestjs-libraries/dtos/projects/project.dto';
import {
  DriveEntry,
  GoogleDriveService,
} from '@gitroom/nestjs-libraries/google-drive/google.drive.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { MediaAutoPostService } from '@gitroom/nestjs-libraries/database/prisma/media/media.autopost.service';

// https://drive.google.com/drive/folders/<id>, .../drive/u/0/folders/<id>,
// open?id=<id> or the id alone
const driveFolderId = (value: string) => {
  const text = value.trim();
  const id =
    text.match(/\/folders\/([A-Za-z0-9_-]{10,})/)?.[1] ||
    text.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1] ||
    text.match(/^([A-Za-z0-9_-]{10,})$/)?.[1];
  if (!id) {
    throw new BadRequestException(`Not a Google Drive folder link: ${text.slice(0, 100)}`);
  }

  return id;
};

const DOCUMENTS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'text/',
];

const fileKind = (mimeType: string) =>
  mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('video/')
    ? 'video'
    : DOCUMENTS.some((p) => mimeType.startsWith(p))
    ? 'document'
    : 'other';

// a source holding more is cut there, deeper folders are skipped
const MAX_FILES = 20000;
const MAX_DEPTH = 20;

// pictures are imported at this size at most, which also keeps raw camera
// files under the upload limit
const IMPORT_SIZE = 2560;

// a sync still marked running after this was cut by a restart
const SYNC_TIMEOUT = 30 * 60 * 1000;

const isStale = (source: { status: string; syncStartedAt: Date | null }) =>
  source.status === 'syncing' &&
  (!source.syncStartedAt || Date.now() - source.syncStartedAt.getTime() > SYNC_TIMEOUT);

@Injectable()
export class ProjectsService {
  // sources being synced by this process
  private static _syncing = new Set<string>();

  constructor(
    private _projectsRepository: ProjectsRepository,
    private _googleDriveService: GoogleDriveService,
    private _mediaService: MediaService,
    private _mediaAutoPostService: MediaAutoPostService
  ) {}

  driveInfo() {
    return {
      enabled: this._googleDriveService.isEnabled(),
      email: this._googleDriveService.email() || null,
    };
  }

  async getProjects(org: string) {
    const [projects, counts] = await Promise.all([
      this._projectsRepository.getProjects(org),
      this._projectsRepository.countFiles(org),
    ]);

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      integrations: project.integrations.map((p) => p.integration),
      folders: project.folders,
      sources: project.sources.map(({ syncStartedAt, ...source }) =>
        isStale({ ...source, syncStartedAt })
          ? { ...source, status: 'error', error: 'The sync was interrupted, sync again' }
          : source
      ),
      files: counts
        .filter((p) => p.projectId === project.id)
        .reduce(
          (all, p) => ({ ...all, [p.kind]: p._count._all }),
          {} as Record<string, number>
        ),
    }));
  }

  async createProject(org: string, body: ProjectDto) {
    const created = await this._projectsRepository.createProject(
      org,
      await this.validate(org, body)
    );
    await this.syncProject(org, created.id, true);
    return created;
  }

  async updateProject(org: string, id: string, body: ProjectDto) {
    await this.findProject(org, id);
    await this._projectsRepository.updateProject(org, id, await this.validate(org, body));
    // the folders just added get listed
    await this.syncProject(org, id, true);
    return { id };
  }

  async deleteProject(org: string, id: string) {
    await this.findProject(org, id);
    await this._projectsRepository.deleteProject(org, id);
    return { id };
  }

  // lists the files of the project's Drive folders in the background, the
  // sources show their progress; onlyNew skips the folders listed before
  async syncProject(org: string, id: string, onlyNew = false) {
    await this.findProject(org, id);
    if (!this._googleDriveService.isEnabled()) {
      if (onlyNew) {
        return { started: 0 };
      }
      throw new BadRequestException('Google Drive is not configured on this server');
    }

    const sources = (await this._projectsRepository.getSources(org, id)).filter(
      (p) =>
        p.type === 'google_drive' &&
        !ProjectsService._syncing.has(p.id) &&
        (p.status !== 'syncing' || isStale(p)) &&
        (!onlyNew || p.status === 'pending')
    );
    for (const source of sources) {
      ProjectsService._syncing.add(source.id);
      this.syncSource(org, id, source)
        .catch((err) => Logger.error(`Could not sync source ${source.id}: ${err}`))
        .finally(() => ProjectsService._syncing.delete(source.id));
    }

    return { started: sources.length };
  }

  private async syncSource(
    org: string,
    projectId: string,
    source: { id: string; externalId: string }
  ) {
    await this._projectsRepository.updateSource(source.id, {
      status: 'syncing',
      error: null,
      syncStartedAt: new Date(),
    });
    try {
      const folder = await this._googleDriveService.getFolder(source.externalId);
      if (!folder) {
        await this._projectsRepository.updateSource(source.id, {
          status: 'no_access',
          error: `Share the folder with ${this._googleDriveService.email()} as a viewer`,
        });
        return;
      }
      if (!folder.isFolder) {
        await this._projectsRepository.updateSource(source.id, {
          status: 'error',
          error: 'This link is a file, not a folder',
        });
        return;
      }

      // walk the tree, keeping the path of every file
      const found: (DriveEntry & { path: string })[] = [];
      const queue = [{ id: source.externalId, path: '', depth: 0 }];
      while (queue.length && found.length < MAX_FILES) {
        const current = queue.shift()!;
        for (const entry of await this._googleDriveService.listFolder(current.id)) {
          if (entry.isFolder) {
            if (current.depth < MAX_DEPTH) {
              queue.push({
                id: entry.id,
                path: current.path ? `${current.path} / ${entry.name}` : entry.name,
                depth: current.depth + 1,
              });
            }
            continue;
          }
          if (found.length < MAX_FILES) {
            found.push({ ...entry, path: current.path });
          }
        }
      }

      const existing = new Map(
        (await this._projectsRepository.getSourceFiles(source.id)).map((p) => [p.externalId, p])
      );
      const details = (entry: (typeof found)[number]) => ({
        name: entry.name,
        path: entry.path,
        mimeType: entry.mimeType,
        kind: fileKind(entry.mimeType),
        size: entry.size !== undefined ? BigInt(entry.size) : undefined,
        width: entry.width,
        height: entry.height,
        durationMs: entry.durationMs,
        modifiedAt: new Date(entry.modifiedTime),
        webUrl: entry.webViewLink,
      });

      const added = found.filter((p) => !existing.has(p.id));
      for (let i = 0; i < added.length; i += 1000) {
        await this._projectsRepository.createFiles(
          added.slice(i, i + 1000).map((entry) => ({
            organizationId: org,
            projectId,
            sourceId: source.id,
            externalId: entry.id,
            ...details(entry),
          }))
        );
      }

      for (const entry of found) {
        const known = existing.get(entry.id);
        if (
          known &&
          (known.deletedAt ||
            known.path !== entry.path ||
            known.modifiedAt.getTime() !== new Date(entry.modifiedTime).getTime())
        ) {
          const changed = known.modifiedAt.getTime() !== new Date(entry.modifiedTime).getTime();
          await this._projectsRepository.updateFile(known.id, {
            ...details(entry),
            size: details(entry).size ?? null,
            width: entry.width ?? null,
            height: entry.height ?? null,
            durationMs: entry.durationMs ?? null,
            deletedAt: null,
            ...(changed ? { analysis: null, analyzedAt: null, mediaId: null } : {}),
          });
        }
      }

      const seen = new Set(found.map((p) => p.id));
      const removed = [...existing.values()]
        .filter((p) => !p.deletedAt && !seen.has(p.externalId))
        .map((p) => p.id);
      for (let i = 0; i < removed.length; i += 1000) {
        await this._projectsRepository.removeFiles(removed.slice(i, i + 1000));
      }

      await this._projectsRepository.updateSource(source.id, {
        status: 'ready',
        name: folder.name || undefined,
        sharedBy: folder.sharedBy || null,
        fileCount: found.length,
        syncedAt: new Date(),
        error: found.length >= MAX_FILES ? `Only the first ${MAX_FILES} files are listed` : null,
      });
    } catch (err) {
      await this._projectsRepository.updateSource(source.id, {
        status: 'error',
        error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
      });
    }
  }

  async getFiles(
    org: string,
    projectId: string,
    query: { kind?: string; search?: string; page?: number }
  ) {
    await this.findProject(org, projectId);
    const take = 100;
    const page = Math.max(0, query.page || 0);
    const [total, files] = await this._projectsRepository.getFiles(org, projectId, {
      kind: query.kind,
      search: query.search?.trim() || undefined,
      skip: page * take,
      take,
    });

    return {
      total,
      pages: Math.ceil(total / take),
      files: files.map((p) => ({ ...p, size: p.size !== null ? Number(p.size) : null })),
    };
  }

  private async findFile(org: string, id: string) {
    const file = await this._projectsRepository.getFile(org, id);
    if (!file) {
      throw new BadRequestException('File not found');
    }

    return file;
  }

  // what Drive shows of the file, scaled down to look at it
  async getFilePreview(org: string, id: string) {
    const file = await this.findFile(org, id);
    const thumbnail = await this._googleDriveService.thumbnail(file.externalId, 1600);
    if (!thumbnail) {
      throw new BadRequestException('Drive has no preview of this file');
    }

    const picture = await sharp(thumbnail)
      .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    return {
      file: { ...file, size: file.size !== null ? Number(file.size) : null },
      data: picture.toString('base64'),
    };
  }

  // copies the file into the media library (once) so posts and designs can use it
  async importFile(org: string, id: string, folderId?: string) {
    const file = await this.findFile(org, id);
    if (file.kind !== 'image' && file.kind !== 'video') {
      throw new BadRequestException('Only pictures and videos can be imported');
    }
    if (file.kind === 'video' && file.mimeType !== 'video/mp4') {
      throw new BadRequestException(
        `Only MP4 videos can be imported, this one is ${file.mimeType}`
      );
    }

    let [media] = file.mediaId
      ? await this._mediaService.getMediaByIds(org, [file.mediaId])
      : [];
    if (!media) {
      let saved;
      if (file.kind === 'image') {
        const picture = await this.importPicture(file.externalId);
        saved = await this._mediaService.uploadFromStream(
          org,
          Readable.toWeb(Readable.from(picture)) as ReadableStream,
          picture.length,
          file.name.replace(/\.[^.]+$/, '') + '.jpg'
        );
      } else {
        saved = await this._mediaService.uploadFromStream(
          org,
          Readable.toWeb(await this._googleDriveService.download(file.externalId)) as ReadableStream,
          file.size !== null ? Number(file.size) : 0,
          file.name
        );
      }
      await this._projectsRepository.setFileMedia(org, file.id, saved.id);
      [media] = await this._mediaService.getMediaByIds(org, [saved.id]);
    }

    if (folderId) {
      await this._mediaAutoPostService.moveMedia(org, { media: [media.id], folderId });
    }

    return { id: media.id, path: media.path, name: media.originalName || media.name };
  }

  // the original turned upright and scaled down; formats sharp can not read
  // (HEIC...) come from Drive's own large preview
  private async importPicture(externalId: string) {
    try {
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of await this._googleDriveService.download(externalId)) {
        total += chunk.length;
        if (total > 60 * 1024 * 1024) {
          throw new Error('too large');
        }
        chunks.push(chunk);
      }

      return await sharp(Buffer.concat(chunks), { limitInputPixels: 100_000_000 })
        .rotate()
        .resize(IMPORT_SIZE, IMPORT_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch (err) {
      const preview = await this._googleDriveService.thumbnail(externalId, IMPORT_SIZE);
      if (!preview) {
        throw new BadRequestException('Could not read this picture');
      }

      return sharp(preview).jpeg({ quality: 90 }).toBuffer();
    }
  }

  private async findProject(org: string, id: string) {
    if (!(await this._projectsRepository.getProject(org, id))) {
      throw new BadRequestException('Project not found');
    }
  }

  private async validate(org: string, body: ProjectDto) {
    const name = body.name.trim();
    if (!name) {
      throw new BadRequestException('Project name is required');
    }

    const integrations = [...new Set(body.integrations)];
    if (
      integrations.length &&
      (await this._projectsRepository.countIntegrations(org, integrations)) !==
        integrations.length
    ) {
      throw new BadRequestException('Channel not found');
    }

    const folders = [...new Set(body.folders)];
    if (
      folders.length &&
      (await this._projectsRepository.countFolders(org, folders)) !== folders.length
    ) {
      throw new BadRequestException('Folder not found');
    }

    const drive = [...new Set(body.driveFolders.map(driveFolderId))];
    if (
      drive.length &&
      (await this._projectsRepository.countSourcesOfOthers(org, 'google_drive', drive))
    ) {
      throw new BadRequestException('This Drive folder is linked to another account');
    }

    return {
      name,
      description: (body.description || '').trim(),
      integrations,
      folders,
      sources: drive.map((externalId) => ({
        type: 'google_drive',
        externalId,
        url: `https://drive.google.com/drive/folders/${externalId}`,
      })),
    };
  }
}
