import { CompletionParams, CompletionResult, ProviderInterface } from '../types';

export const anthropicProvider: ProviderInterface = {
  async complete(params: CompletionParams): Promise<CompletionResult> {
    const { messages, apiKey, model, systemPrompt } = params;
    const modelToUse = model || 'claude-3-5-sonnet-20240620';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelToUse,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return { content: data.content[0]?.text || '' };
  },

  async listModels(apiKey: string): Promise<string[]> {
      return [
         'claude-4.5-opus',
         'claude-3-5-sonnet-20240620',
         'claude-3-opus-20240229',
         'claude-3-sonnet-20240229',
         'claude-3-haiku-20240307'
      ];
  }
};
