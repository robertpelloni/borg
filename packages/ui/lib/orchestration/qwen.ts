/**
 * Alibaba Qwen Model Integration
 * Ported from antigravity-jules-orchestration/lib/qwen.js
 */

const QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

interface QwenCompletionParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  apiKey?: string;
}

export async function qwenCompletion(params: QwenCompletionParams) {
  const {
    prompt,
    model = 'qwen-turbo',
    maxTokens = 2000,
    temperature = 0.7,
    systemPrompt = 'You are a helpful coding assistant.',
    apiKey = process.env.ALIBABA_API_KEY
  } = params;

  if (!apiKey) {
    throw new Error('ALIBABA_API_KEY not configured.');
  }

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
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ]
        },
        parameters: {
            max_tokens: maxTokens,
            temperature: temperature,
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

  return {
      success: true,
      model: model,
      content: data.output.choices?.[0]?.message?.content || data.output.text,
      usage: data.usage || {},
      requestId: data.request_id
  };
}

export const QWEN_MODELS = [
    { id: 'qwen-turbo', description: 'Fast, cost-effective model for simple tasks', tokens: '8K context' },
    { id: 'qwen-plus', description: 'Balanced performance and quality', tokens: '32K context' },
    { id: 'qwen-max', description: 'Most capable model for complex reasoning', tokens: '32K context' },
    { id: 'qwen-max-longcontext', description: 'Extended context for large codebases', tokens: '1M context' },
    { id: 'qwen-coder-plus', description: 'Specialized for code generation', tokens: '128K context' }
];
