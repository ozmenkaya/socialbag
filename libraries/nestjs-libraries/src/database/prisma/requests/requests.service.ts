import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import { RequestsRepository } from '@gitroom/nestjs-libraries/database/prisma/requests/requests.repository';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ProjectsRepository } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.repository';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

export const REQUEST_STATUSES = ['new', 'in_progress', 'done'] as const;

// the files a customer uploaded on the portal, the only ones they can attach
const uploadsKey = (clientId: string) => `portal-uploads:${clientId}`;

@Injectable()
export class RequestsService {
  constructor(
    private _requestsRepository: RequestsRepository,
    private _mediaService: MediaService,
    private _projectsRepository: ProjectsRepository,
    private _notificationService: NotificationService
  ) {}

  // a photo or video the customer sends from the portal goes to the media
  // library, it is attached to a request once that is sent
  async saveUpload(
    org: string,
    clientId: string,
    file: { filename: string; path: string; originalname: string }
  ) {
    // normalized like the uploads of the media library, before it is posted
    const media = await this._mediaService.saveUploadedFile(
      org,
      file.filename,
      file.path,
      file.originalname
    );
    await ioRedis.rpush(uploadsKey(clientId), media.id);
    await ioRedis.expire(uploadsKey(clientId), 86400);
    return { id: media.id, path: media.path, name: file.originalname };
  }

  private async uploadsOf(clientId: string): Promise<string[]> {
    return (await ioRedis.lrange(uploadsKey(clientId), 0, -1)) || [];
  }

  // a file removed from the form before the request was sent
  async removeUpload(org: string, clientId: string, mediaId: string) {
    if (!(await this.uploadsOf(clientId)).includes(mediaId)) {
      throw new NotFoundException('File not found');
    }
    await this._mediaService.deleteMedia(org, mediaId);
    return { id: mediaId };
  }

  async createRequest(
    org: string,
    client: { id: string; name: string; projectIds: string[] },
    body: { projectId: string; title: string; description?: string; wantedDate?: string; mediaIds?: string[] }
  ) {
    if (!client.projectIds.includes(body.projectId)) {
      throw new NotFoundException('Project not found');
    }

    const uploads = await this.uploadsOf(client.id);
    const mediaIds = [...new Set(body.mediaIds || [])];
    if (mediaIds.some((p) => !uploads.includes(p))) {
      throw new BadRequestException('Dosyaları tekrar yükleyin');
    }

    const wantedDate = body.wantedDate ? dayjs(body.wantedDate) : undefined;
    const request = await this._requestsRepository.createRequest({
      organizationId: org,
      projectId: body.projectId,
      clientId: client.id,
      clientName: client.name,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      wantedDate: wantedDate?.isValid() ? wantedDate.toDate() : undefined,
      mediaIds,
    });

    // the request is saved, what follows must not make the customer send it
    // again
    try {
      // next to the other media of the project
      const project = await this._projectsRepository.getRequestFolder(org, body.projectId);
      if (mediaIds.length && project?.folders[0]) {
        await this._mediaService.moveMedia(org, {
          media: mediaIds,
          folderId: project.folders[0].id,
        });
      }

      // the customer's words also go into an email, without markup
      await this._notificationService.inAppNotification(
        org,
        'Yeni müşteri talebi',
        `${project?.name ? `${project.name}: ` : ''}${client.name} bir talep gönderdi: "${body.title
          .trim()
          .replace(/[<>]/g, '')}"${mediaIds.length ? ` (${mediaIds.length} dosya)` : ''}`,
        true
      );
    } catch (err) {
      Logger.error(`Customer request ${request.id} saved, but: ${err}`);
    }

    return { id: request.id };
  }

  async getRequests(
    org: string,
    query: { projectIds?: string[]; status?: string; requestId?: string; take?: number }
  ) {
    const list = await this._requestsRepository.getRequests(org, {
      ...query,
      take: query.take || 100,
    });
    const media = await this._mediaService.getMediaByIds(
      org,
      [...new Set(list.flatMap((p) => p.mediaIds))]
    );

    return list.map(({ project, mediaIds, ...request }) => ({
      ...request,
      projectName: project.name,
      media: mediaIds
        .map((id) => media.find((m) => m.id === id))
        .filter((p) => p)
        .map((p) => ({ id: p!.id, path: p!.path, thumbnail: p!.thumbnail })),
    }));
  }

  async updateRequest(org: string, id: string, body: { status?: string; reply?: string }) {
    if (!(await this._requestsRepository.getRequest(org, id))) {
      throw new NotFoundException('Request not found');
    }
    await this._requestsRepository.updateRequest(id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.reply !== undefined ? { reply: body.reply.trim() || null } : {}),
    });
    return { id };
  }
}
