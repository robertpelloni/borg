/**
 * Bootstrap utilities for resilient initialization
 *
 * Provides retry logic with exponential backoff and fallback defaults
 * for the bootstrap phase (initial data loading).
 */

/**
 * Default model limits to use when:
 * - Bootstrap fetch fails after all retries
 * - Model ID not found in cached limits
 *
 * Values chosen based on common model capabilities:
 * - context: 128k tokens (GPT-4 Turbo, Claude 3, etc.)
 * - output: 4k tokens (typical for most models)
 */
export const DEFAULT_MODEL_LIMITS = {
	context: 128000,
	output: 4096,
} as const

/**
 * Retry configuration
 */
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1000 // 1s base delay

/**
 * Fetch model limits with retry logic and exponential backoff
 *
 * Retry schedule:
 * - Attempt 1: immediate
 * - Attempt 2: after 1s (1000ms)
 * - Attempt 3: after 2s (2000ms)
 * Total: 3 attempts over ~3 seconds
 *
 * @param fetchFn - Async function that fetches model limits
 * @returns Model limits object or empty object if all retries fail
 *
 * @example
 * ```tsx
 * const limits = await fetchModelLimitsWithRetry(async () => {
 *   const client = await getClient()
 *   const response = await client.provider.list()
 *   return extractModelLimits(response)
 * })
 * ```
 *
 * @remarks
 * TODO: Add jitter to backoff for production (prevents thundering herd).
 * See hivemind learning: "Exponential Backoff with Jitter for Reconnection"
 * Formula: min(baseDelay * 2^attempt, maxDelay) + random(0, jitterFactor * delay)
 */
export async function fetchModelLimitsWithRetry(
	fetchFn: () => Promise<Record<string, { context: number; output: number }>>,
): Promise<Record<string, { context: number; output: number }>> {
	let lastError: Error | unknown = null

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			// Try to fetch
			const result = await fetchFn()
			return result
		} catch (error) {
			lastError = error

			// Don't retry after the last attempt
			if (attempt === MAX_RETRIES - 1) {
				break
			}

			// Calculate exponential backoff delay: 1s, 2s, 4s, ...
			const delayMs = BACKOFF_BASE_MS * 2 ** attempt

			console.debug(
				`[OpenCode] Retrying model limits fetch (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delayMs}ms`,
				error instanceof Error ? error.message : error,
			)

			// Wait before retry
			await new Promise((resolve) => setTimeout(resolve, delayMs))
		}
	}

	// All retries failed
	console.warn(
		"[OpenCode] Failed to load model limits after all retries. Context usage will be unavailable.",
		lastError instanceof Error ? lastError.message : lastError,
	)

	return {}
}
