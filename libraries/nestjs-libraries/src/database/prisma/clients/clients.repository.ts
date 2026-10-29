import {
  PrismaRepository,
  PrismaTransaction,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientsRepository {
  constructor(
    private _client: PrismaRepository<'projectClient'>,
    private _clientProject: PrismaRepository<'projectClientProject'>,
    private _project: PrismaRepository<'project'>,
    private _transaction: PrismaTransaction
  ) {}

  getClients(org: string) {
    return this._client.model.projectClient.findMany({
      where: {
        organizationId: org,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        username: true,
        lastLoginAt: true,
        createdAt: true,
        projects: {
          where: {
            project: {
              deletedAt: null,
            },
          },
          select: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  getClient(org: string, id: string) {
    return this._client.model.projectClient.findFirst({
      where: {
        id,
        organizationId: org,
      },
      select: {
        id: true,
      },
    });
  }

  usernameTaken(username: string, exceptId?: string) {
    return this._client.model.projectClient.count({
      where: {
        username,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
  }

  countProjects(org: string, ids: string[]) {
    return this._project.model.project.count({
      where: {
        id: { in: ids },
        organizationId: org,
        deletedAt: null,
      },
    });
  }

  createClient(
    org: string,
    data: { name: string; username: string; password: string; projectIds: string[] }
  ) {
    return this._client.model.projectClient.create({
      data: {
        organizationId: org,
        name: data.name,
        username: data.username,
        password: data.password,
        projects: {
          create: data.projectIds.map((projectId) => ({ projectId })),
        },
      },
      select: {
        id: true,
      },
    });
  }

  // a new password signs the open sessions of the customer out
  updateClient(
    id: string,
    data: { name: string; username: string; password?: string; projectIds: string[] }
  ) {
    return this._transaction.model.$transaction([
      this._clientProject.model.projectClientProject.deleteMany({
        where: { clientId: id },
      }),
      this._client.model.projectClient.update({
        where: { id },
        data: {
          name: data.name,
          username: data.username,
          ...(data.password
            ? { password: data.password, sessionVersion: { increment: 1 } }
            : {}),
          projects: {
            create: data.projectIds.map((projectId) => ({ projectId })),
          },
        },
        select: {
          id: true,
        },
      }),
    ]);
  }

  deleteClient(id: string) {
    return this._client.model.projectClient.delete({
      where: { id },
      select: { id: true },
    });
  }

  getLogin(username: string) {
    return this._client.model.projectClient.findUnique({
      where: { username },
      select: {
        id: true,
        password: true,
        sessionVersion: true,
      },
    });
  }

  setLastLogin(id: string) {
    return this._client.model.projectClient.update({
      where: { id },
      data: { lastLoginAt: new Date() },
      select: { id: true },
    });
  }

  setPassword(id: string, password: string) {
    return this._client.model.projectClient.update({
      where: { id },
      data: { password, sessionVersion: { increment: 1 } },
      select: { id: true, sessionVersion: true },
    });
  }

  // the signed in customer, with the projects they follow and their channels
  getPortalClient(id: string) {
    return this._client.model.projectClient.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        name: true,
        username: true,
        password: true,
        sessionVersion: true,
        organization: {
          select: {
            name: true,
          },
        },
        projects: {
          where: {
            project: {
              deletedAt: null,
            },
          },
          select: {
            project: {
              select: {
                id: true,
                name: true,
                description: true,
                brand: true,
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
              },
            },
          },
        },
      },
    });
  }
}
