import { Injectable } from '@nestjs/common';
import { AdsProvider } from '@gitroom/nestjs-libraries/ads/ads.interface';
import { MetaAdsProvider } from '@gitroom/nestjs-libraries/ads/providers/meta.ads.provider';

export const adsProviderList: AdsProvider[] = [new MetaAdsProvider()];

@Injectable()
export class AdsManager {
  getAllProviders() {
    return adsProviderList.map((p) => ({
      identifier: p.identifier,
      name: p.name,
      socialProviders: p.socialProviders,
    }));
  }

  getProvider(identifier: string) {
    return adsProviderList.find((p) => p.identifier === identifier);
  }

  getProviderForSocial(socialIdentifier: string) {
    return adsProviderList.find((p) =>
      p.socialProviders.includes(socialIdentifier)
    );
  }
}
