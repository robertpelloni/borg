export interface CompletionParams {
  messages: { role: string; content: string }[];
  apiKey: string;
  model?: string;
  systemPrompt?: string;
}

export interface CompletionResult {
  content: string;
}

export interface ProviderInterface {
  complete(params: CompletionParams): Promise<CompletionResult>;
  listModels(apiKey: string): Promise<string[]>;
}
