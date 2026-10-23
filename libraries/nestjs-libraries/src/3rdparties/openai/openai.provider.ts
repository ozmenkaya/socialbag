import {
  ThirdParty,
  ThirdPartyAbstract,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';

// Only stores the key: the agent (/agents) reads it, so it is not shown in
// the post editor (no position)
@ThirdParty({
  identifier: 'openai',
  title: 'OpenAI (Agent)',
  description:
    'Runs the agent with GPT, when OpenRouter or Claude is not connected.',
  fields: [],
  // an API key can't read the balance
  balance: { url: 'https://platform.openai.com/settings/organization/billing/overview' },
})
export class OpenaiProvider extends ThirdPartyAbstract {
  async checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    // listing the models spends nothing
    const models = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!models.ok) {
      return false;
    }

    // one connection per organization: connecting again replaces the key
    return { name: 'OpenAI', username: 'openai', id: 'openai' };
  }

  async sendData(): Promise<string> {
    throw new Error('OpenAI is used by the agent');
  }
}
