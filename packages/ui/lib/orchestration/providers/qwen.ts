import { CompletionParams, CompletionResult, ProviderInterface } from '../types';

const QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export const qwenProvider: ProviderInterface = {
  async complete(params: CompletionParams): Promise<CompletionResult> {
    const { messages, apiKey, model = 'qwen-turbo', systemPrompt } = params;

    // Construct messages array for Qwen
    const qwenMessages = [
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        ...messages
    ];

    const response = await fetch(QWEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-DashScope-SSE': 'disable'
        },
        body: JSON.stringify({
            model: model,
            input: {
                messages: qwenMessages
            },
            parameters: {
                max_tokens: 300,
                result_format: 'message'
            }
        })
      });

      if (!response.ok) {
         const err = await response.json().catch(() => ({}));
         throw new Error(`Qwen API Error: ${response.status} - ${err.message || response.statusText}`);
      }

      const data = await response.json();
      if (data.code) {
          throw new Error(`Qwen API Error: ${data.code} - ${data.message}`);
      }

      return { content: data.output.choices?.[0]?.message?.content || '' };
  },

  async listModels(apiKey: string): Promise<string[]> {
      return [
        'qwen-turbo',
        'qwen-plus',
        'qwen-max',
        'qwen-max-longcontext',
        'qwen-coder-plus'
      ];
  }
};
