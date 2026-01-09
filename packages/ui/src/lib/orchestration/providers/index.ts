import { ProviderInterface } from '../types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { qwenProvider } from './qwen';

export const providers: Record<string, ProviderInterface> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  qwen: qwenProvider,
};

export function getProvider(name: string): ProviderInterface | undefined {
  return providers[name];
}

export async function generateText({
  provider,
  apiKey,
  model,
  messages
}: {
  provider: string;
  apiKey: string;
  model: string;
  messages: { role: string; content: string }[];
}): Promise<string> {
  const aiProvider = getProvider(provider);
  if (!aiProvider) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const result = await aiProvider.complete({
    messages,
    apiKey,
    model
  });

  return result.content;
}
