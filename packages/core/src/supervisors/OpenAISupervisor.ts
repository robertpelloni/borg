/**
 * OpenAISupervisor - GPT-4 and other OpenAI model supervisor
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

export class OpenAISupervisor extends BaseSupervisor {
  constructor(config: SupervisorConfig) {
    super(config);
    
    // Try environment variable if not provided
    if (!this.apiKey) {
      this.apiKey = process.env.OPENAI_API_KEY ?? '';
    }
  }

  protected getDefaultModel(): string {
    return 'gpt-4o';
  }

  protected getDefaultBaseURL(): string {
    return 'https://api.openai.com/v1';
  }

  async chat(messages: CouncilMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new Error(`OpenAI API key not configured for supervisor: ${this.name}`);
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

    const response = await fetchWithRetry(
      this.name,
      `${this.baseURL}/chat/completions`,
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
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    return data.choices[0]?.message?.content ?? '';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
