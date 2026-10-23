import {
  ThirdParty,
  ThirdPartyAbstract,
  ThirdPartyBalance,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { LumaService } from '@gitroom/nestjs-libraries/openai/luma.service';

// Only stores the key: the AI design tools of the media library call Luma
// through LumaService, so it is not shown in the post editor (no position)
@ThirdParty({
  identifier: 'luma',
  title: 'Luma AI',
  description:
    'Luma AI generates the images and videos of the AI design tools, using the media library as reference.',
  fields: [],
  balance: { function: 'balance' },
})
export class LumaProvider extends ThirdPartyAbstract {
  // @ts-ignore
  constructor(private _lumaService: LumaService) {
    super();
  }

  async checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    if ((await this._lumaService.getCredits(apiKey)) === false) {
      return false;
    }

    // one Luma connection per organization: connecting again replaces the key
    return { name: 'Luma AI', username: 'luma', id: 'luma' };
  }

  async balance(apiKey: string): Promise<ThirdPartyBalance> {
    const credits = await this._lumaService.getCredits(apiKey);
    return credits === false ? false : { amount: credits, unit: 'credits' };
  }

  async sendData(): Promise<string> {
    throw new Error('Luma AI is used from the AI design tools of the media library');
  }
}
