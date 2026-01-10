import { CallToolHandler, CallToolMiddleware, MetaMCPHandlerContext } from './functional-middleware.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (context: MetaMCPHandlerContext, toolName: string) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100
};

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.limits) {
        if (now > entry.resetAt) {
          this.limits.delete(key);
        }
      }
    }, this.config.windowMs);
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs
      };
      this.limits.set(key, entry);
    }

    entry.count++;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = entry.count <= this.config.maxRequests;

    return { allowed, remaining, resetAt: entry.resetAt };
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.limits.clear();
  }
}

const globalLimiter = new RateLimiter();
const toolLimiters: Map<string, RateLimiter> = new Map();

export function createRateLimitMiddleware(config?: Partial<RateLimitConfig>): CallToolMiddleware {
  const limiter = config ? new RateLimiter(config) : globalLimiter;

  return (handler: CallToolHandler): CallToolHandler => {
    return async (request, context): Promise<CallToolResult> => {
      const toolName = request.params?.name as string || 'unknown';
      const keyGen = config?.keyGenerator || defaultKeyGenerator;
      const key = keyGen(context, toolName);

      const result = limiter.check(key);

      if (!result.allowed) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'rate_limit_exceeded',
              message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetAt - Date.now()) / 1000)} seconds.`,
              retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
            })
          }],
          isError: true
        };
      }

      return handler(request, context);
    };
  };
}

export function createToolSpecificLimiter(toolName: string, config: Partial<RateLimitConfig>): void {
  toolLimiters.set(toolName, new RateLimiter(config));
}

export function getToolLimiter(toolName: string): RateLimiter | undefined {
  return toolLimiters.get(toolName);
}

function defaultKeyGenerator(context: MetaMCPHandlerContext, toolName: string): string {
  const userId = context.userId || context.sessionId || 'anonymous';
  return `${userId}:${toolName}`;
}

export { RateLimiter, RateLimitConfig };
