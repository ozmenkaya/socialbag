import { BadRequestException, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { AdsRepository } from '@gitroom/nestjs-libraries/database/prisma/ads/ads.repository';
import { AdsManager } from '@gitroom/nestjs-libraries/ads/ads.manager';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import {
  BoostStatusDto,
  CreateBoostDto,
} from '@gitroom/nestjs-libraries/dtos/ads/ads.dto';

@Injectable()
export class AdsService {
  constructor(
    private _adsRepository: AdsRepository,
    private _adsManager: AdsManager
  ) {}

  getProviders() {
    return this._adsManager.getAllProviders();
  }

  getConnections(orgId: string) {
    return this._adsRepository.getConnections(orgId);
  }

  private getProvider(identifier: string) {
    const provider = this._adsManager.getProvider(identifier);
    if (!provider) {
      throw new BadRequestException('Unknown ads provider');
    }

    return provider;
  }

  private async getConnection(orgId: string, id: string) {
    const connection = await this._adsRepository.getConnection(orgId, id);
    if (!connection) {
      throw new BadRequestException('Ads connection not found');
    }

    return connection;
  }

  async getAuthUrl(orgId: string, identifier: string) {
    const provider = this.getProvider(identifier);
    const state = makeId(20);
    await ioRedis.set(`ads:${state}`, orgId, 'EX', 3600);

    return { url: provider.generateAuthUrl(state) };
  }

  async connect(orgId: string, identifier: string, code: string, state: string) {
    const provider = this.getProvider(identifier);
    const stateOrg = await ioRedis.get(`ads:${state}`);
    if (stateOrg !== orgId) {
      throw new BadRequestException('Invalid or expired connection request');
    }
    await ioRedis.del(`ads:${state}`);

    const details = await provider.authenticate(code);
    return this._adsRepository.saveConnection(orgId, identifier, details);
  }

  deleteConnection(orgId: string, id: string) {
    return this._adsRepository.deleteConnection(orgId, id);
  }

  async getAdAccounts(orgId: string, connectionId: string) {
    const connection = await this.getConnection(orgId, connectionId);
    return this.getProvider(connection.provider).adAccounts(connection.token);
  }

  async createBoost(orgId: string, body: CreateBoostDto) {
    if (body.ageMin > body.ageMax) {
      throw new BadRequestException('Minimum age can not be above maximum age');
    }

    const post = await this._adsRepository.getPostForBoost(orgId, body.postId);
    if (
      !post ||
      post.state !== 'PUBLISHED' ||
      !post.releaseId ||
      post.releaseId === 'missing'
    ) {
      throw new BadRequestException('Only published posts can be promoted');
    }

    const connection = await this.getConnection(orgId, body.connectionId);
    const provider = this.getProvider(connection.provider);
    if (!provider.socialProviders.includes(post.integration.providerIdentifier)) {
      throw new BadRequestException(
        'This channel can not be promoted with the selected ads account'
      );
    }

    const startDate = dayjs().add(10, 'minutes').toDate();
    const endDate = dayjs(startDate).add(body.days, 'days').toDate();

    const result = await provider.boost(
      connection.token,
      {
        providerIdentifier: post.integration.providerIdentifier,
        internalId: post.integration.internalId,
        releaseId: post.releaseId,
      },
      {
        name: `Postiz boost ${post.id} ${dayjs().format('YYYY-MM-DD HH:mm')}`,
        adAccountId: body.adAccountId,
        objective: body.objective,
        dailyBudget: body.dailyBudget,
        startDate,
        endDate,
        countries: body.countries.map((p) => p.toUpperCase()),
        ageMin: body.ageMin,
        ageMax: body.ageMax,
        specialAdCategory: body.specialAdCategory,
      }
    );

    return this._adsRepository.createBoost(orgId, {
      postId: post.id,
      connectionId: connection.id,
      adAccountId: body.adAccountId,
      campaignId: result.campaignId,
      adSetId: result.adSetId,
      adId: result.adId,
      objective: body.objective,
      dailyBudget: Math.round(body.dailyBudget * 100),
      currency: result.currency,
      startDate,
      endDate,
    });
  }

  async getBoosts(orgId: string, postId: string) {
    const boosts = await this._adsRepository.getBoosts(orgId, postId);

    return Promise.all(
      boosts.map(async (boost) => {
        const provider = this.getProvider(boost.connection.provider);
        const connected = !boost.connection.deletedAt;
        const insights = connected
          ? await provider
              .insights(boost.connection.token, boost)
              .catch(() => undefined)
          : undefined;

        return {
          id: boost.id,
          objective: boost.objective,
          dailyBudget: boost.dailyBudget / 100,
          currency: boost.currency,
          startDate: boost.startDate,
          endDate: boost.endDate,
          status: boost.status,
          connectionName: boost.connection.name,
          connected,
          manageUrl: provider.manageUrl(boost.adAccountId, boost),
          insights,
        };
      })
    );
  }

  private async getManageableBoost(orgId: string, id: string) {
    const boost = await this._adsRepository.getBoost(orgId, id);
    if (!boost) {
      throw new BadRequestException(
        'Ad not found, or its ads account was disconnected. Reconnect the ads account to manage it.'
      );
    }

    return boost;
  }

  async changeBoostStatus(orgId: string, id: string, body: BoostStatusDto) {
    const boost = await this.getManageableBoost(orgId, id);

    await this.getProvider(boost.connection.provider).changeStatus(
      boost.connection.token,
      boost,
      body.status
    );

    return this._adsRepository.updateBoostStatus(orgId, id, body.status);
  }

  async deleteBoost(orgId: string, id: string) {
    const boost = await this.getManageableBoost(orgId, id);

    await this.getProvider(boost.connection.provider).remove(
      boost.connection.token,
      boost
    );

    return this._adsRepository.deleteBoost(orgId, id);
  }
}
