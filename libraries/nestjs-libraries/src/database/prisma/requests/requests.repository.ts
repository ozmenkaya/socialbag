import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

const REQUEST_SELECT = {
  id: true,
  projectId: true,
  clientName: true,
  title: true,
  description: true,
  wantedDate: true,
  mediaIds: true,
  status: true,
  reply: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      name: true,
    },
  },
} as const;

@Injectable()
export class RequestsRepository {
  constructor(private _request: PrismaRepository<'projectRequest'>) {}

  createRequest(data: {
    organizationId: string;
    projectId: string;
    clientId: string;
    clientName: string;
    title: string;
    description: string;
    wantedDate?: Date;
    mediaIds: string[];
  }) {
    return this._request.model.projectRequest.create({
      data,
      select: { id: true },
    });
  }

  getRequests(
    org: string,
    query: { projectIds?: string[]; status?: string; take: number }
  ) {
    return this._request.model.projectRequest.findMany({
      where: {
        organizationId: org,
        ...(query.projectIds ? { projectId: { in: query.projectIds } } : {}),
        ...(query.status ? { status: query.status } : {}),
        project: {
          deletedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.take,
      select: REQUEST_SELECT,
    });
  }

  getRequest(org: string, id: string) {
    return this._request.model.projectRequest.findFirst({
      where: { id, organizationId: org },
      select: { id: true },
    });
  }

  updateRequest(id: string, data: { status?: string; reply?: string | null }) {
    return this._request.model.projectRequest.update({
      where: { id },
      data,
      select: { id: true },
    });
  }
}
