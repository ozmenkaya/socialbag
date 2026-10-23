import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface ProjectData {
  name: string;
  description: string;
  integrations: string[];
  folders: string[];
  sources: { type: string; externalId: string; url: string }[];
}

@Injectable()
export class ProjectsRepository {
  constructor(
    private _project: PrismaRepository<'project'>,
    private _projectIntegration: PrismaRepository<'projectIntegration'>,
    private _projectSource: PrismaRepository<'projectSource'>,
    private _projectFile: PrismaRepository<'projectFile'>,
    private _mediaFolder: PrismaRepository<'mediaFolder'>,
    private _integration: PrismaRepository<'integration'>,
    private _transaction: PrismaTransaction
  ) {}

  getProjects(org: string) {
    return this._project.model.project.findMany({
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
        description: true,
        integrations: {
          where: {
            integration: {
              deletedAt: null,
            },
          },
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
        folders: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
          },
        },
        sources: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            type: true,
            externalId: true,
            url: true,
            name: true,
            status: true,
            error: true,
            fileCount: true,
            sharedBy: true,
            syncStartedAt: true,
            syncedAt: true,
          },
        },
      },
    });
  }

  getProject(org: string, id: string) {
    return this._project.model.project.findFirst({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
      },
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

  countFolders(org: string, ids: string[]) {
    return this._mediaFolder.model.mediaFolder.count({
      where: {
        id: { in: ids },
        organizationId: org,
        deletedAt: null,
      },
    });
  }

  // the project and its links in one transaction
  async createProject(org: string, data: ProjectData) {
    const id = randomUUID();
    await this._transaction.model.$transaction([
      this._project.model.project.create({
        data: {
          id,
          organizationId: org,
          name: data.name,
          description: data.description,
        },
        select: {
          id: true,
        },
      }),
      ...this.links(org, id, data),
    ]);

    return { id };
  }

  updateProject(org: string, id: string, data: ProjectData) {
    return this._transaction.model.$transaction([
      this._project.model.project.update({
        where: {
          id,
          organizationId: org,
        },
        data: {
          name: data.name,
          description: data.description,
        },
        select: {
          id: true,
        },
      }),
      ...this.links(org, id, data),
    ]);
  }

  // A media folder belongs to one project, linking it here unlinks it elsewhere
  private links(org: string, id: string, data: ProjectData) {
    return [
      this._projectIntegration.model.projectIntegration.deleteMany({
        where: {
          projectId: id,
        },
      }),
      this._projectIntegration.model.projectIntegration.createMany({
        data: data.integrations.map((integrationId) => ({
          projectId: id,
          integrationId,
        })),
      }),
      this._mediaFolder.model.mediaFolder.updateMany({
        where: {
          organizationId: org,
          projectId: id,
          id: { notIn: data.folders },
        },
        data: {
          projectId: null,
        },
      }),
      this._mediaFolder.model.mediaFolder.updateMany({
        where: {
          organizationId: org,
          id: { in: data.folders },
        },
        data: {
          projectId: id,
        },
      }),
      this._projectFile.model.projectFile.deleteMany({
        where: {
          projectId: id,
          source: {
            externalId: { notIn: data.sources.map((p) => p.externalId) },
          },
        },
      }),
      this._projectSource.model.projectSource.deleteMany({
        where: {
          projectId: id,
          externalId: { notIn: data.sources.map((p) => p.externalId) },
        },
      }),
      this._projectSource.model.projectSource.createMany({
        data: data.sources.map((p) => ({ ...p, projectId: id })),
        skipDuplicates: true,
      }),
    ];
  }

  countFiles(org: string) {
    return this._projectFile.model.projectFile.groupBy({
      by: ['projectId', 'kind'],
      where: {
        organizationId: org,
        deletedAt: null,
      },
      _count: {
        _all: true,
      },
    });
  }

  getSources(org: string, projectId: string) {
    return this._projectSource.model.projectSource.findMany({
      where: {
        projectId,
        project: {
          organizationId: org,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        type: true,
        externalId: true,
        status: true,
        syncStartedAt: true,
      },
    });
  }

  // a Drive folder is read through the one service account of the server, so
  // it may only be linked by one customer
  countSourcesOfOthers(org: string, type: string, externalIds: string[]) {
    return this._projectSource.model.projectSource.count({
      where: {
        type,
        externalId: { in: externalIds },
        project: {
          organizationId: { not: org },
          deletedAt: null,
        },
      },
    });
  }

  updateSource(
    id: string,
    data: {
      status: string;
      name?: string;
      error?: string | null;
      fileCount?: number;
      sharedBy?: string | null;
      syncStartedAt?: Date;
      syncedAt?: Date;
    }
  ) {
    return this._projectSource.model.projectSource.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
      },
    });
  }

  // deleted ones too, so a file put back is restored instead of added again
  getSourceFiles(sourceId: string) {
    return this._projectFile.model.projectFile.findMany({
      where: {
        sourceId,
      },
      select: {
        id: true,
        externalId: true,
        modifiedAt: true,
        path: true,
        deletedAt: true,
      },
    });
  }

  createFiles(
    data: {
      organizationId: string;
      projectId: string;
      sourceId: string;
      externalId: string;
      name: string;
      path: string;
      mimeType: string;
      kind: string;
      size?: bigint;
      width?: number;
      height?: number;
      durationMs?: number;
      modifiedAt: Date;
      webUrl: string;
    }[]
  ) {
    return this._projectFile.model.projectFile.createMany({
      data,
      skipDuplicates: true,
    });
  }

  updateFile(
    id: string,
    data: {
      name: string;
      path: string;
      mimeType: string;
      kind: string;
      size?: bigint | null;
      width?: number | null;
      height?: number | null;
      durationMs?: number | null;
      modifiedAt: Date;
      webUrl: string;
      deletedAt: null;
      // a changed file has to be looked at and imported again
      analysis?: null;
      analyzedAt?: null;
      mediaId?: null;
    }
  ) {
    return this._projectFile.model.projectFile.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
      },
    });
  }

  removeFiles(ids: string[]) {
    return this._projectFile.model.projectFile.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  getFiles(
    org: string,
    projectId: string,
    query: { kind?: string; search?: string; skip: number; take: number }
  ) {
    const where: Prisma.ProjectFileWhereInput = {
      organizationId: org,
      projectId,
      deletedAt: null,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { path: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return this._transaction.model.$transaction([
      this._projectFile.model.projectFile.count({ where }),
      this._projectFile.model.projectFile.findMany({
        where,
        orderBy: [{ path: 'asc' }, { name: 'asc' }],
        skip: query.skip,
        take: query.take,
        select: {
          id: true,
          name: true,
          path: true,
          mimeType: true,
          kind: true,
          size: true,
          width: true,
          height: true,
          durationMs: true,
          modifiedAt: true,
          webUrl: true,
          mediaId: true,
          analyzedAt: true,
        },
      }),
    ]);
  }

  getFile(org: string, id: string) {
    return this._projectFile.model.projectFile.findFirst({
      where: {
        id,
        organizationId: org,
        deletedAt: null,
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        path: true,
        mimeType: true,
        kind: true,
        size: true,
        width: true,
        height: true,
        durationMs: true,
        webUrl: true,
        mediaId: true,
        projectId: true,
      },
    });
  }

  setFileMedia(org: string, id: string, mediaId: string) {
    return this._projectFile.model.projectFile.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        mediaId,
      },
      select: {
        id: true,
      },
    });
  }

  deleteProject(org: string, id: string) {
    return this._transaction.model.$transaction([
      this._projectIntegration.model.projectIntegration.deleteMany({
        where: {
          projectId: id,
        },
      }),
      this._mediaFolder.model.mediaFolder.updateMany({
        where: {
          organizationId: org,
          projectId: id,
        },
        data: {
          projectId: null,
        },
      }),
      this._projectFile.model.projectFile.deleteMany({
        where: {
          projectId: id,
        },
      }),
      this._projectSource.model.projectSource.deleteMany({
        where: {
          projectId: id,
        },
      }),
      this._project.model.project.update({
        where: {
          id,
          organizationId: org,
        },
        data: {
          deletedAt: new Date(),
        },
        select: {
          id: true,
        },
      }),
    ]);
  }
}
