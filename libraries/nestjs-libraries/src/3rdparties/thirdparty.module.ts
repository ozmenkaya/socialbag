import { Global, Module } from '@nestjs/common';
import { HeygenProvider } from '@gitroom/nestjs-libraries/3rdparties/heygen/heygen.provider';
import { ReelFarmProvider } from '@gitroom/nestjs-libraries/3rdparties/reelfarm/reelfarm.provider';
import { HubspotProvider } from '@gitroom/nestjs-libraries/3rdparties/hubspot/hubspot.provider';
import { LumaProvider } from '@gitroom/nestjs-libraries/3rdparties/luma/luma.provider';
import { OpenaiProvider } from '@gitroom/nestjs-libraries/3rdparties/openai/openai.provider';
import { AnthropicProvider } from '@gitroom/nestjs-libraries/3rdparties/anthropic/anthropic.provider';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';

@Global()
@Module({
  providers: [
    HeygenProvider,
    ReelFarmProvider,
    HubspotProvider,
    LumaProvider,
    OpenaiProvider,
    AnthropicProvider,
    ThirdPartyManager,
  ],
  get exports() {
    return this.providers;
  },
})
export class ThirdPartyModule {}
