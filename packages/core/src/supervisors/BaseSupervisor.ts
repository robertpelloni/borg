/**
 * BaseSupervisor - Abstract base class for AI council supervisors
 * Provides common functionality for LLM-based supervisors using AIOS ModelGateway
 */

// Local type definitions (mirrors @aios/types/council)
export interface CouncilMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SupervisorConfig {
  name: string;
  provider: string;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  systemPrompt?: string;
  temperature?: number;
  weight?: number;
}

export interface Supervisor {
  name: string;
  provider: string;
  chat(messages: CouncilMessage[]): Promise<string>;
  isAvailable(): Promise<boolean>;
}

/**
 * Default retry configuration for supervisor API calls
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Fetch with exponential backoff retry logic
 */
export async function fetchWithRetry(
  supervisorName: string,
  url: string,
  options: RequestInit,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | null = null;
  let delay = config.baseDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on rate limits (429) or server errors (5xx)
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (attempt < config.maxRetries) {
          console.warn(`[${supervisorName}] Retrying after ${response.status} (attempt ${attempt + 1}/${config.maxRetries})`);
          await sleep(delay);
          delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < config.maxRetries) {
        console.warn(`[${supervisorName}] Retrying after error (attempt ${attempt + 1}/${config.maxRetries}):`, lastError.message);
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch after ${config.maxRetries} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Abstract base class for supervisors
 * Subclasses must implement chat() and isAvailable()
 */
export abstract class BaseSupervisor implements Supervisor {
  readonly name: string;
  readonly provider: string;
  
  protected apiKey: string;
  protected model: string;
  protected baseURL: string;
  protected systemPrompt?: string;
  protected temperature: number;
  protected retryConfig: RetryConfig;

  constructor(config: SupervisorConfig) {
    this.name = config.name;
    this.provider = config.provider;
    this.apiKey = config.apiKey ?? '';
    this.model = config.model ?? this.getDefaultModel();
    this.baseURL = config.baseURL ?? this.getDefaultBaseURL();
    this.systemPrompt = config.systemPrompt;
    this.temperature = config.temperature ?? 0.7;
    this.retryConfig = DEFAULT_RETRY_CONFIG;
  }

  /**
   * Get default model for this provider
   */
  protected abstract getDefaultModel(): string;

  /**
   * Get default base URL for this provider
   */
  protected abstract getDefaultBaseURL(): string;

  /**
   * Send chat messages and get a response
   */
  abstract chat(messages: CouncilMessage[]): Promise<string>;

  /**
   * Check if the supervisor is available (has valid API key and can respond)
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Set the API key (useful for runtime configuration)
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Get configuration info (for debugging/status)
   */
  getInfo(): { name: string; provider: string; model: string; hasApiKey: boolean } {
    return {
      name: this.name,
      provider: this.provider,
      model: this.model,
      hasApiKey: this.hasApiKey(),
    };
  }
}
