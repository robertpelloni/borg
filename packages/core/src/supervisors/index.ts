/**
 * Supervisors module - AI council supervisor implementations
 * Factory and registry for creating supervisors from configuration
 */

export { BaseSupervisor, fetchWithRetry } from './BaseSupervisor.js';
export type { Supervisor, SupervisorConfig, CouncilMessage } from './BaseSupervisor.js';
export { OpenAISupervisor } from './OpenAISupervisor.js';
export { AnthropicSupervisor } from './AnthropicSupervisor.js';
export { GenericOpenAISupervisor } from './GenericOpenAISupervisor.js';

import type { SupervisorConfig, Supervisor } from './BaseSupervisor.js';
import { OpenAISupervisor } from './OpenAISupervisor.js';
import { AnthropicSupervisor } from './AnthropicSupervisor.js';
import { GenericOpenAISupervisor } from './GenericOpenAISupervisor.js';

const OPENAI_PROVIDERS = ['openai', 'gpt'];
const ANTHROPIC_PROVIDERS = ['anthropic', 'claude'];
const GENERIC_PROVIDERS = ['deepseek', 'xai', 'grok', 'qwen', 'moonshot', 'kimi', 'gemini', 'google', 'custom'];

export function createSupervisor(config: SupervisorConfig): Supervisor {
  const provider = config.provider.toLowerCase();

  if (OPENAI_PROVIDERS.includes(provider)) {
    return new OpenAISupervisor(config);
  }

  if (ANTHROPIC_PROVIDERS.includes(provider)) {
    return new AnthropicSupervisor(config);
  }

  if (GENERIC_PROVIDERS.includes(provider) || config.baseURL) {
    return new GenericOpenAISupervisor(config);
  }

  throw new Error(`Unknown supervisor provider: ${config.provider}. Supported: openai, anthropic, deepseek, xai, grok, qwen, moonshot, kimi, gemini, google, custom`);
}

export class SupervisorRegistry {
  private supervisors: Map<string, Supervisor> = new Map();

  add(config: SupervisorConfig): Supervisor {
    const supervisor = createSupervisor(config);
    this.supervisors.set(config.name, supervisor);
    return supervisor;
  }

  get(name: string): Supervisor | undefined {
    return this.supervisors.get(name);
  }

  getAll(): Supervisor[] {
    return Array.from(this.supervisors.values());
  }

  remove(name: string): boolean {
    return this.supervisors.delete(name);
  }

  clear(): void {
    this.supervisors.clear();
  }

  async getAvailable(): Promise<Supervisor[]> {
    const results = await Promise.all(
      this.getAll().map(async (s) => ({ supervisor: s, available: await s.isAvailable() }))
    );
    return results.filter((r) => r.available).map((r) => r.supervisor);
  }

  has(name: string): boolean {
    return this.supervisors.has(name);
  }

  size(): number {
    return this.supervisors.size;
  }
}
