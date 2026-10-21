import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AdsAuthDetails } from '@gitroom/nestjs-libraries/ads/ads.interface';
import dayjs from 'dayjs';

@Injectable()
export class AdsRepository {
  constructor(
    private _adsConnection: PrismaRepository<'adsConnection'>,
    private _postBoost: PrismaRepository<'postBoost'>,
    private _post: PrismaRepository<'post'>
  ) {}

  getConnections(orgId: string) {
    return this._adsConnection.model.adsConnection.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      select: {
        id: true,
        provider: true,
        name: true,
        picture: true,
        tokenExpiration: true,
        createdAt: true,
      },
    });
  }

  getConnection(orgId: string, id: string) {
    return this._adsConnection.model.adsConnection.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
    });
  }

  saveConnection(orgId: string, provider: string, details: AdsAuthDetails) {
    const data = {
      name: details.name,
      picture: details.picture,
      token: details.accessToken,
      tokenExpiration: dayjs().add(details.expiresIn, 'seconds').toDate(),
      deletedAt: null as Date | null,
    };

    return this._adsConnection.model.adsConnection.upsert({
      where: {
        organizationId_provider_internalId: {
          organizationId: orgId,
          provider,
          internalId: details.id,
        },
      },
      create: {
        organizationId: orgId,
        provider,
        internalId: details.id,
        ...data,
      },
      update: data,
      select: {
        id: true,
      },
    });
  }

  deleteConnection(orgId: string, id: string) {
    return this._adsConnection.model.adsConnection.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }

  getPostForBoost(orgId: string, postId: string) {
    return this._post.model.post.findFirst({
      where: {
        id: postId,
        organizationId: orgId,
        deletedAt: null,
      },
      select: {
        id: true,
        state: true,
        releaseId: true,
        integration: {
          select: {
            providerIdentifier: true,
            internalId: true,
          },
        },
      },
    });
  }

  createBoost(
    orgId: string,
    data: {
      postId: string;
      connectionId: string;
      adAccountId: string;
      campaignId: string;
      adSetId: string;
      adId: string;
      objective: string;
      dailyBudget: number;
      currency: string;
      startDate: Date;
      endDate: Date;
    }
  ) {
    return this._postBoost.model.postBoost.create({
      data: {
        organizationId: orgId,
        status: 'PAUSED',
        ...data,
      },
      select: {
        id: true,
      },
    });
  }

  getBoosts(orgId: string, postId: string) {
    return this._postBoost.model.postBoost.findMany({
      where: {
        organizationId: orgId,
        postId,
        deletedAt: null,
      },
      include: {
        connection: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  getBoost(orgId: string, id: string) {
    return this._postBoost.model.postBoost.findFirst({
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
      },
      include: {
        connection: true,
      },
    });
  }

  updateBoostStatus(orgId: string, id: string, status: string) {
    return this._postBoost.model.postBoost.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        status,
      },
      select: {
        id: true,
      },
    });
  }

  deleteBoost(orgId: string, id: string) {
    return this._postBoost.model.postBoost.update({
      where: {
        id,
        organizationId: orgId,
      },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }
}
