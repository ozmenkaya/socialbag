import { BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  AdsAccount,
  AdsAuthDetails,
  AdsProvider,
  BoostIds,
  BoostInsights,
  BoostParams,
  BoostResult,
  BoostStatus,
  BoostTarget,
} from '@gitroom/nestjs-libraries/ads/ads.interface';
import { META_GRAPH_API_VERSION } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';

const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// Currencies Meta counts in whole units instead of cents
const NO_OFFSET_CURRENCIES = [
  'CLP',
  'COP',
  'CRC',
  'HUF',
  'ISK',
  'IDR',
  'JPY',
  'KRW',
  'PYG',
  'TWD',
  'VND',
];

const OBJECTIVES = {
  engagement: {
    objective: 'OUTCOME_ENGAGEMENT',
    optimization_goal: 'POST_ENGAGEMENT',
    destination_type: 'ON_POST',
  },
  awareness: {
    objective: 'OUTCOME_AWARENESS',
    optimization_goal: 'REACH',
    destination_type: undefined as string | undefined,
  },
};

export class MetaAdsProvider implements AdsProvider {
  identifier = 'meta';
  name = 'Meta';
  socialProviders = ['facebook', 'instagram'];
  scopes = [
    'ads_management',
    'ads_read',
    'business_management',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_ads',
    'instagram_basic',
  ];

  private redirectUri() {
    return `${process.env.FRONTEND_URL}/integrations/ads/meta`;
  }

  private async request(url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    const json = await response.json().catch(() => ({}));
    if (json?.error) {
      throw new BadRequestException(
        json.error.error_user_msg || json.error.message || 'Meta request failed'
      );
    }

    return json;
  }

  private post(path: string, token: string, body: Record<string, any>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) {
        continue;
      }
      params.append(
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      );
    }
    params.append('access_token', token);

    return this.request(`${GRAPH}/${path}`, {
      method: 'POST',
      body: params,
    });
  }

  generateAuthUrl(state: string) {
    return (
      `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth` +
      `?client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri())}` +
      `&state=${state}` +
      `&scope=${this.scopes.join(',')}`
    );
  }

  async authenticate(code: string): Promise<AdsAuthDetails> {
    const shortToken = await this.request(
      `${GRAPH}/oauth/access_token` +
        `?client_id=${process.env.FACEBOOK_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(this.redirectUri())}` +
        `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
        `&code=${encodeURIComponent(code)}`
    );

    const { access_token, expires_in } = await this.request(
      `${GRAPH}/oauth/access_token` +
        '?grant_type=fb_exchange_token' +
        `&client_id=${process.env.FACEBOOK_APP_ID}` +
        `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
        `&fb_exchange_token=${shortToken.access_token}`
    );

    const { data } = await this.request(
      `${GRAPH}/me/permissions?access_token=${access_token}`
    );
    const granted = (data || [])
      .filter((p: any) => p.status === 'granted')
      .map((p: any) => p.permission);
    const missing = this.scopes.filter((p) => !granted.includes(p));
    if (missing.length) {
      throw new BadRequestException(
        `Missing permissions: ${missing.join(', ')}`
      );
    }

    const { id, name, picture } = await this.request(
      `${GRAPH}/me?fields=id,name,picture&access_token=${access_token}`
    );

    return {
      id,
      name,
      picture: picture?.data?.url || '',
      accessToken: access_token,
      expiresIn: expires_in || dayjs().add(59, 'days').unix() - dayjs().unix(),
    };
  }

  async adAccounts(token: string): Promise<AdsAccount[]> {
    const { data } = await this.request(
      `${GRAPH}/me/adaccounts?fields=id,name,currency,account_status&limit=100&access_token=${token}`
    );

    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      currency: p.currency,
      active: p.account_status === 1,
    }));
  }

  // Instagram media is promoted through the Facebook page the account is linked to
  private async instagramPage(token: string, instagramId: string) {
    const { data } = await this.request(
      `${GRAPH}/me/accounts?fields=id,instagram_business_account&limit=100&access_token=${token}`
    );
    const page = (data || []).find(
      (p: any) => p.instagram_business_account?.id === instagramId
    );
    if (!page) {
      throw new BadRequestException(
        'The Instagram account is not linked to a Facebook page you manage'
      );
    }

    return page.id as string;
  }

  private async creative(
    token: string,
    target: BoostTarget,
    params: BoostParams
  ) {
    if (target.providerIdentifier === 'instagram') {
      return this.post(`${params.adAccountId}/adcreatives`, token, {
        name: params.name,
        object_id: await this.instagramPage(token, target.internalId),
        instagram_user_id: target.internalId,
        source_instagram_media_id: target.releaseId,
      });
    }

    // Feed posts are stored as pageId_postId, videos and reels only as the video id
    return this.post(`${params.adAccountId}/adcreatives`, token, {
      name: params.name,
      object_story_id: target.releaseId.includes('_')
        ? target.releaseId
        : `${target.internalId}_${target.releaseId}`,
    });
  }

  async boost(
    token: string,
    target: BoostTarget,
    params: BoostParams
  ): Promise<BoostResult> {
    const { currency } = await this.request(
      `${GRAPH}/${params.adAccountId}?fields=currency&access_token=${token}`
    );
    const offset = NO_OFFSET_CURRENCIES.includes(currency) ? 1 : 100;
    const settings = OBJECTIVES[params.objective];
    const housing = params.specialAdCategory === 'HOUSING';

    const campaign = await this.post(`${params.adAccountId}/campaigns`, token, {
      name: params.name,
      objective: settings.objective,
      status: 'PAUSED',
      special_ad_categories: housing ? ['HOUSING'] : [],
      special_ad_category_country: housing ? params.countries : undefined,
      is_adset_budget_sharing_enabled: false,
    });

    try {
      const adSet = await this.post(`${params.adAccountId}/adsets`, token, {
        name: params.name,
        campaign_id: campaign.id,
        daily_budget: Math.round(params.dailyBudget * offset),
        billing_event: 'IMPRESSIONS',
        optimization_goal: settings.optimization_goal,
        destination_type: settings.destination_type,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        start_time: params.startDate.toISOString(),
        end_time: params.endDate.toISOString(),
        status: 'PAUSED',
        targeting: {
          geo_locations: { countries: params.countries },
          // housing ads can not be narrowed by age
          ...(housing ? {} : { age_min: params.ageMin, age_max: params.ageMax }),
          publisher_platforms: [
            target.providerIdentifier === 'instagram' ? 'instagram' : 'facebook',
          ],
          targeting_automation: { advantage_audience: 0 },
        },
      });

      const creative = await this.creative(token, target, params);

      const ad = await this.post(`${params.adAccountId}/ads`, token, {
        name: params.name,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
      });

      return {
        campaignId: campaign.id,
        adSetId: adSet.id,
        adId: ad.id,
        currency,
      };
    } catch (err) {
      // Do not leave a half built campaign behind
      await this.request(`${GRAPH}/${campaign.id}?access_token=${token}`, {
        method: 'DELETE',
      }).catch(() => {});
      throw err;
    }
  }

  async changeStatus(token: string, ids: BoostIds, status: BoostStatus) {
    // Pausing the campaign stops all spend. When starting, the campaign goes
    // last so a failure in between never leaves anything delivering.
    const order =
      status === 'PAUSED'
        ? [ids.campaignId]
        : [ids.adId, ids.adSetId, ids.campaignId];
    for (const id of order) {
      await this.post(id, token, { status });
    }
  }

  async remove(token: string, ids: BoostIds) {
    const response = await fetch(
      `${GRAPH}/${ids.campaignId}?access_token=${token}`,
      { method: 'DELETE' }
    );
    const json = await response.json().catch(() => ({}));
    // code 100: the campaign was already deleted in Ads Manager
    if (json?.error && json.error.code !== 100) {
      throw new BadRequestException(
        json.error.error_user_msg || json.error.message || 'Meta request failed'
      );
    }
  }

  async insights(token: string, ids: BoostIds): Promise<BoostInsights> {
    const { data } = await this.request(
      `${GRAPH}/${ids.campaignId}/insights?fields=spend,impressions,reach,clicks&date_preset=maximum&access_token=${token}`
    );
    const [row] = data || [];

    return {
      spend: Number(row?.spend || 0),
      impressions: Number(row?.impressions || 0),
      reach: Number(row?.reach || 0),
      clicks: Number(row?.clicks || 0),
    };
  }

  manageUrl(adAccountId: string, ids: BoostIds) {
    return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace(
      'act_',
      ''
    )}&selected_campaign_ids=${ids.campaignId}`;
  }
}
