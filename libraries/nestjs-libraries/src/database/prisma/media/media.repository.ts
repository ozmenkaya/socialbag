import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';

@Injectable()
export class MediaRepository {
  constructor(
    private _media: PrismaRepository<'media'>,
    private _mediaFolder: PrismaRepository<'mediaFolder'>,
    private _mediaFolderIntegration: PrismaRepository<'mediaFolderIntegration'>,
    private _integration: PrismaRepository<'integration'>,
    private _transaction: PrismaTransaction
  ) {}

  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._media.model.media.create({
      data: {
        organization: {
          connect: {
            id: org,
          },
        },
        name: fileName,
        path: filePath,
        originalName: originalName || null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        status: true,
      },
    });
  }

  startProcessing(org: string, id: string) {
    return this._media.model.media.update({
      where: { id, organizationId: org },
      data: { status: 'processing', processingError: null },
      select: { id: true, status: true },
    });
  }

  finishProcessing(
    org: string,
    id: string,
    data: { name?: string; path?: string; fileSize?: number; error?: string }
  ) {
    return this._media.model.media.update({
      where: { id, organizationId: org },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.path ? { path: data.path } : {}),
        ...(data.fileSize ? { fileSize: data.fileSize } : {}),
        status: data.error ? 'failed' : 'ready',
        processingError: data.error || null,
      },
      select: { id: true, status: true },
    });
  }

  getMediaStatus(org: string, id: string) {
    return this._media.model.media.findFirst({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        status: true,
        processingError: true,
      },
    });
  }

  getMediaById(id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
      },
    });
  }

  deleteMedia(org: string, id: string) {
    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._media.model.media.update({
      where: {
        id: data.id,
        organizationId: org,
      },
      data: {
        alt: data.alt,
        thumbnail: data.thumbnail,
        thumbnailTimestamp: data.thumbnailTimestamp,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
      },
    });
  }

  // folder: undefined lists everything, 'root' only media outside folders
  async getMedia(org: string, page: number, search?: string, folder?: string) {
    const pageNum = (page || 1) - 1;
    const trimmedSearch = search?.trim();
    const searchFilter = {
      ...(trimmedSearch
        ? {
            originalName: {
              contains: trimmedSearch,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(folder ? { folderId: folder === 'root' ? null : folder } : {}),
    };
    const query = {
      where: {
        organization: {
          id: org,
        },
        deletedAt: null,
        status: { not: 'processing' },
        ...searchFilter,
      },
    };
    const pages = Math.ceil((await this._media.model.media.count(query)) / 18);
    const results = await this._media.model.media.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        // still being normalized: it shows up once the workflow releases it
        status: { not: 'processing' },
        ...searchFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        createdAt: true,
      },
      skip: pageNum * 18,
      take: 18,
    });

    return {
      pages,
      results,
    };
  }

  getFolders(org: string) {
    return this._mediaFolder.model.mediaFolder.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        parentId: true,
        integrations: {
          select: {
            integration: {
              select: {
                id: true,
                name: true,
                picture: true,
                providerIdentifier: true,
              },
            },
          },
        },
        _count: {
          select: {
            media: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });
  }

  createFolder(org: string, name: string, parentId?: string) {
    return this._mediaFolder.model.mediaFolder.create({
      data: {
        organizationId: org,
        name,
        parentId: parentId || null,
      },
      select: {
        id: true,
      },
    });
  }

  updateFolder(
    org: string,
    id: string,
    data: { name?: string; parentId?: string | null }
  ) {
    return this._mediaFolder.model.mediaFolder.update({
      where: {
        id,
        organizationId: org,
      },
      data,
      select: {
        id: true,
      },
    });
  }

  countIntegrations(org: string, ids: string[]) {
    return this._integration.model.integration.count({
      where: {
        id: { in: ids },
        organizationId: org,
        deletedAt: null,
      },
    });
  }

  // A channel belongs to one folder, linking it here unlinks it elsewhere
  setFolderIntegrations(folderId: string, integrationIds: string[]) {
    return this._transaction.model.$transaction([
      this._mediaFolderIntegration.model.mediaFolderIntegration.deleteMany({
        where: {
          OR: [{ folderId }, { integrationId: { in: integrationIds } }],
        },
      }),
      this._mediaFolderIntegration.model.mediaFolderIntegration.createMany({
        data: integrationIds.map((integrationId) => ({
          folderId,
          integrationId,
        })),
      }),
    ]);
  }

  // Media of the removed folders moves up to moveTo (null: outside folders)
  deleteFolders(org: string, ids: string[], moveTo: string | null) {
    return this._transaction.model.$transaction([
      this._media.model.media.updateMany({
        where: {
          organizationId: org,
          folderId: { in: ids },
        },
        data: {
          folderId: moveTo,
        },
      }),
      this._mediaFolderIntegration.model.mediaFolderIntegration.deleteMany({
        where: {
          folderId: { in: ids },
        },
      }),
      this._mediaFolder.model.mediaFolder.updateMany({
        where: {
          organizationId: org,
          id: { in: ids },
        },
        data: {
          deletedAt: new Date(),
        },
      }),
    ]);
  }

  moveMedia(org: string, mediaIds: string[], folderId: string | null) {
    return this._media.model.media.updateMany({
      where: {
        organizationId: org,
        id: { in: mediaIds },
        deletedAt: null,
      },
      data: {
        folderId,
      },
    });
  }
}
