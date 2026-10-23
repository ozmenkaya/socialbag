import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
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
