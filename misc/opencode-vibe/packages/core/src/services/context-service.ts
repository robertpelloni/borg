/**
 * ContextService - Compute context usage from message tokens
 *
 * Implements context usage computation:
 * 1. Token summation (input + output + reasoning + cache.read)
 * 2. Usable context calculation (limit - output reserve)
 * 3. Percentage computation
 * 4. Formatted string output
 *
 * This is pure computation with no side effects, so uses 'sync' factory pattern.
 */

import { Effect } from "effect"
import { formatTokens } from "../utils/index.js"

/**
 * Model limits
 */
export interface ModelLimits {
	context: number
	output: number
}

/**
 * Token usage breakdown
 */
export interface TokenUsage {
	input: number
	output: number
	reasoning?: number
	cache?: {
		read: number
		write: number
	}
}

/**
 * Context usage computation result
 */
export interface ContextUsage {
	/** Total tokens used (input + output + reasoning + cache.read) */
	used: number
	/** Model's context window limit */
	limit: number
	/** Usable context (limit - output reserve) */
	usableContext: number
	/** Percentage of usable context used (0-100+) */
	percentage: number
	/** Formatted string: "1.5K / 128K (1%)" */
	formatted: string
	/** Token breakdown */
	tokens: {
		input: number
		output: number
		cached: number
	}
}

/**
 * Input for computeUsage
 */
export interface ComputeUsageInput {
	tokens: TokenUsage
	modelLimits: ModelLimits
}

/**
 * ContextService - Effect service for context usage computation
 *
 * Pure computation service with no lifecycle management.
 * Uses 'sync' factory pattern.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const service = yield* _(ContextService)
 *   return service.computeUsage({
 *     tokens: { input: 1000, output: 500 },
 *     modelLimits: { context: 200000, output: 8192 }
 *   })
 * })
 *
 * const usage = await runWithRuntime(program)
 * console.log(usage.formatted) // "1.5K / 200K (1%)"
 * ```
 */
export class ContextService extends Effect.Service<ContextService>()("ContextService", {
	sync: () => ({
		/**
		 * Compute context usage from tokens and model limits
		 *
		 * Algorithm:
		 * 1. Sum all tokens (input + output + reasoning + cache.read)
		 *    - cache.write does NOT count toward context (only affects billing)
		 * 2. Calculate usable context = limit - min(outputLimit, 32000)
		 *    - Reserve space for output tokens, cap at 32K
		 * 3. Calculate percentage = (used / usableContext) * 100
		 * 4. Format as "1.5K / 128K (1%)"
		 *
		 * @param input - Token usage and model limits
		 * @returns Context usage with breakdown and formatted string
		 */
		computeUsage: (input: ComputeUsageInput): ContextUsage => {
			const { tokens, modelLimits } = input

			// STEP 1: Sum all tokens that count toward context limit
			// See mem-76c40b377882e1f5: Total = input + output + (reasoning ?? 0) + (cache?.read ?? 0)
			const used =
				tokens.input + tokens.output + (tokens.reasoning ?? 0) + (tokens.cache?.read ?? 0)

			// STEP 2: Calculate usable context (reserve space for output)
			// Cap output reserve at 32K to match React layer logic
			const outputReserve = Math.min(modelLimits.output, 32000)
			const usableContext = modelLimits.context - outputReserve

			// STEP 3: Calculate percentage
			const percentage = Math.round((used / usableContext) * 100)

			// STEP 4: Format output string
			const usedFormatted = formatTokens(used)
			const limitFormatted = formatTokens(modelLimits.context)
			const formatted = `${usedFormatted} / ${limitFormatted} (${percentage}%)`

			return {
				used,
				limit: modelLimits.context,
				usableContext,
				percentage,
				formatted,
				tokens: {
					input: tokens.input,
					output: tokens.output,
					cached: tokens.cache?.read ?? 0,
				},
			}
		},
	}),
}) {}
