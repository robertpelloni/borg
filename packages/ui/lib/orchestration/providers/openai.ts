import { CompletionParams, CompletionResult, ProviderInterface } from '../types';

export const openaiProvider: ProviderInterface = {
  async complete(params: CompletionParams): Promise<CompletionResult> {
    const { messages, apiKey, model, systemPrompt } = params;
    const modelToUse = model || 'gpt-4o';

    const msgs = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
    }));

    if (systemPrompt) {
        msgs.unshift({ role: 'system', content: systemPrompt });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: msgs,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return { content: data.choices[0]?.message?.content || '' };
  },

  async listModels(apiKey: string): Promise<string[]> {
     const resp = await fetch('https://api.openai.com/v1/models', {
         headers: { 'Authorization': `Bearer ${apiKey}` }
     });
     if (!resp.ok) throw new Error('Failed to fetch OpenAI models');
     const data = await resp.json();
     return data.data.map((m: any) => m.id).sort();
  }
};
