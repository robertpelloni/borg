/**
 * AnthropicSupervisor - Claude model supervisor
 */

import { BaseSupervisor, fetchWithRetry, type SupervisorConfig, type CouncilMessage } from './BaseSupervisor.js';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export class AnthropicSupervisor extends BaseSupervisor {
  private anthropicVersion: string = '2023-06-01';

  constructor(config: SupervisorConfig) {
    super(config);
    
    // Try environment variable if not provided
    if (!this.apiKey) {
      this.apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    }
  }

  protected getDefaultModel(): string {
    return 'claude-3-5-sonnet-20241022';
  }

  protected getDefaultBaseURL(): string {
    return 'https://api.anthropic.com';
  }

  async chat(messages: CouncilMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error(`Anthropic API key not configured for supervisor: ${this.name}`);
    }

    const anthropicMessages: AnthropicMessage[] = [];
    let systemContent = this.systemPrompt ?? '';

    // Anthropic handles system messages differently - they go in a separate field
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemContent = systemContent ? `${systemContent}\n\n${msg.content}` : msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Anthropic requires conversation to start with a user message
    if (anthropicMessages.length === 0 || anthropicMessages[0].role !== 'user') {
      throw new Error('Anthropic requires conversation to start with a user message');
    }

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages: anthropicMessages,
      temperature: this.temperature,
    };

    if (systemContent) {
      body.system = systemContent;
    }

    const response = await fetchWithRetry(
      this.name,
      `${this.baseURL}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.anthropicVersion,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const textContent = data.content.find((c) => c.type === 'text');
    return textContent?.text ?? '';
  }

  async isAvailable(): Promise<boolean> {
    // Anthropic doesn't have a simple health check endpoint
    // Just check if we have an API key configured
    return Boolean(this.apiKey);
  }
}
