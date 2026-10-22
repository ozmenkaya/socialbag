import {
  ThirdParty,
  ThirdPartyAbstract,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';

export const OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-sonnet-5.5';

// Only stores the key and the model: the agent (/agents) reads them, so it is
// not shown in the post editor (no position)
@ThirdParty({
  identifier: 'openrouter',
  title: 'OpenRouter (Agent)',
  description:
    'Runs the agent with the model you pick among hundreds (Claude, GPT, Gemini, DeepSeek...), it is used first when connected.',
  fields: [],
  choice: { title: 'Model', function: 'models', default: OPENROUTER_DEFAULT_MODEL },
})
export class OpenrouterProvider extends ThirdPartyAbstract {
  async checkConnection(
    apiKey: string
  ): Promise<false | { name: string; username: string; id: string }> {
    // reads the key's own details, spends nothing
    const key = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!key.ok) {
      return false;
    }

    // one connection per organization: connecting again replaces the key
    return { name: 'OpenRouter', username: 'openrouter', id: 'openrouter' };
  }

  // the agent needs tools, so only the models that support them
  async models() {
    const { data } = await (
      await fetch('https://openrouter.ai/api/v1/models?supported_parameters=tools')
    ).json();

    return (data as { id: string; name: string }[])
      .filter((p) => !p.id.endsWith(':batch'))
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async sendData(): Promise<string> {
    throw new Error('OpenRouter is used by the agent');
  }
}
