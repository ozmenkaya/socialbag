import {
  ThirdParty,
  ThirdPartyAbstract,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';

// Only stores the key: the agent (/agents) reads it, so it is not shown in
// the post editor (no position)
@ThirdParty({
  identifier: 'anthropic',
  title: 'Claude (Agent)',
  description: 'Runs the agent with Claude Opus, when OpenRouter is not connected.',
  fields: [],
})
export class AnthropicProvider extends ThirdPartyAbstract {
  async checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    // listing the models spends nothing
    const models = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });

    if (!models.ok) {
      return false;
    }

    // one connection per organization: connecting again replaces the key
    return { name: 'Claude', username: 'anthropic', id: 'anthropic' };
  }

  async sendData(): Promise<string> {
    throw new Error('Claude is used by the agent');
  }
}
