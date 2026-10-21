export type BoostObjective = 'engagement' | 'awareness';
export type BoostStatus = 'ACTIVE' | 'PAUSED';
export type SpecialAdCategory = 'NONE' | 'HOUSING';

export interface AdsAuthDetails {
  id: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresIn: number; // seconds until the token expires
}

export interface AdsAccount {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

// The published post to promote, as stored by the social provider
export interface BoostTarget {
  providerIdentifier: string;
  internalId: string;
  releaseId: string;
}

export interface BoostParams {
  name: string;
  adAccountId: string;
  objective: BoostObjective;
  dailyBudget: number; // in the ad account currency, major units (e.g. 150.5)
  startDate: Date;
  endDate: Date;
  countries: string[];
  ageMin: number;
  ageMax: number;
  specialAdCategory: SpecialAdCategory;
}

export interface BoostIds {
  campaignId: string;
  adSetId: string;
  adId: string;
}

export interface BoostResult extends BoostIds {
  currency: string;
}

export interface BoostInsights {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
}

export interface AdsProvider {
  identifier: string;
  name: string;
  socialProviders: string[]; // social provider identifiers whose posts can be promoted
  generateAuthUrl(state: string): string;
  authenticate(code: string): Promise<AdsAuthDetails>;
  adAccounts(token: string): Promise<AdsAccount[]>;
  boost(
    token: string,
    target: BoostTarget,
    params: BoostParams
  ): Promise<BoostResult>; // Everything is created paused, nothing is spent until changeStatus(ACTIVE)
  changeStatus(token: string, ids: BoostIds, status: BoostStatus): Promise<void>;
  remove(token: string, ids: BoostIds): Promise<void>;
  insights(token: string, ids: BoostIds): Promise<BoostInsights>;
  manageUrl(adAccountId: string, ids: BoostIds): string; // Link to the platform's own ads manager
}
