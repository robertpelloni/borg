/**
 * GenericOpenAISupervisor - Supervisor for OpenAI-compatible APIs
 * Supports: DeepSeek, Grok (xAI), Qwen, Kimi (Moonshot), and other OpenAI-compatible providers
 */

import { BaseSupervisor, fetchWithRetry, type SupervisorConfig, type CouncilMessage } from './BaseSupervisor.js';

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Provider-specific configurations
 */
const PROVIDER_CONFIGS: Record<string, { baseURL: string; defaultModel: string; envKey: string }> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
  },
  xai: {
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-beta',
    envKey: 'XAI_API_KEY',
  },
  grok: {
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-beta',
    envKey: 'GROK_API_KEY',
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    envKey: 'QWEN_API_KEY',
  },
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    envKey: 'MOONSHOT_API_KEY',
  },
  kimi: {
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    envKey: 'KIMI_API_KEY',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-pro',
    envKey: 'GEMINI_API_KEY',
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-pro',
    envKey: 'GOOGLE_API_KEY',
  },
  custom: {
    baseURL: '',
    defaultModel: 'default',
    envKey: '',
  },
};

export class GenericOpenAISupervisor extends BaseSupervisor {
  private providerConfig: { baseURL: string; defaultModel: string; envKey: string };

  constructor(config: SupervisorConfig) {
    super(config);
    
    // Get provider-specific config
    const providerKey = config.provider.toLowerCase();
    this.providerConfig = PROVIDER_CONFIGS[providerKey] ?? PROVIDER_CONFIGS.custom;

    // Use provided baseURL or fall back to provider default
    if (!this.baseURL) {
      this.baseURL = this.providerConfig.baseURL;
    }

    // Use provided model or fall back to provider default
    if (!config.model) {
      this.model = this.providerConfig.defaultModel;
    }

    // Try environment variable if API key not provided
    if (!this.apiKey && this.providerConfig.envKey) {
      this.apiKey = process.env[this.providerConfig.envKey] ?? '';
      
      // Try alternate env var names
      if (!this.apiKey) {
        if (providerKey === 'grok') {
          this.apiKey = process.env.XAI_API_KEY ?? '';
        } else if (providerKey === 'kimi') {
          this.apiKey = process.env.MOONSHOT_API_KEY ?? '';
        } else if (providerKey === 'google') {
          this.apiKey = process.env.GEMINI_API_KEY ?? '';
        }
      }
    }

    // Validate that we have a baseURL for custom providers
    if (!this.baseURL) {
      throw new Error(`Base URL required for generic OpenAI supervisor: ${this.name} (provider: ${config.provider})`);
    }
  }

  protected getDefaultModel(): string {
    return this.providerConfig?.defaultModel ?? 'default';
  }

  protected getDefaultBaseURL(): string {
    return this.providerConfig?.baseURL ?? '';
  }

  async chat(messages: CouncilMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error(`API key not configured for supervisor: ${this.name} (${this.provider})`);
    }

    const openaiMessages: OpenAIChatMessage[] = [];

    // Add system prompt if configured
    if (this.systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: this.systemPrompt,
      });
    }

    // Convert council messages to OpenAI format
    for (const msg of messages) {
      openaiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Handle endpoint path - some providers include /chat/completions, others don't
    const baseUrl = this.baseURL.replace(/\/$/, '');
    const endpoint = baseUrl.includes('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;

    const response = await fetchWithRetry(
      this.name,
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: openaiMessages,
          temperature: this.temperature,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.provider} API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    return data.choices[0]?.message?.content ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.baseURL);
  }
}
