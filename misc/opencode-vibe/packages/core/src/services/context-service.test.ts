/**
 * ContextService tests
 *
 * Tests context usage computation:
 * - Token summation (input + output + reasoning + cache)
 * - Limit lookup from model
 * - Percentage calculation
 * - Formatted string output
 */

import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { ContextService } from "./context-service.js"

/**
 * Helper to run Effect and extract result
 */
async function runEffect<A>(effect: Effect.Effect<A, never, ContextService>): Promise<A> {
	return Effect.runPromise(Effect.provide(effect, ContextService.Default))
}

describe("ContextService", () => {
	describe("Token summation", () => {
		it("sums input + output tokens", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.used).toBe(1500)
		})

		it("includes reasoning tokens when present", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
						reasoning: 200,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.used).toBe(1700)
		})

		it("includes cache.read tokens when present", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
						cache: { read: 300, write: 100 },
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.used).toBe(1800) // input + output + cache.read (NOT cache.write)
		})

		it("handles all token types together", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
						reasoning: 200,
						cache: { read: 300, write: 100 },
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.used).toBe(2000) // input + output + reasoning + cache.read
		})

		it("handles missing optional token fields", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
						// No reasoning, no cache
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.used).toBe(1500)
		})
	})

	describe("Percentage calculation", () => {
		it("calculates percentage using usable context (limit - output reserve)", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			// usableContext = 200000 - min(8192, 32000) = 200000 - 8192 = 191808
			// percentage = round((1500 / 191808) * 100) = round(0.782) = 1
			expect(result.percentage).toBe(1)
		})

		it("caps output reserve at 32000", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 50000,
						output: 10000,
					},
					modelLimits: { context: 200000, output: 100000 }, // Huge output limit
				})
			})

			const result = await runEffect(effect)
			// usableContext = 200000 - min(100000, 32000) = 200000 - 32000 = 168000
			// percentage = round((60000 / 168000) * 100) = round(35.714) = 36
			expect(result.percentage).toBe(36)
		})

		it("rounds to nearest integer", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 100,
						output: 50,
					},
					modelLimits: { context: 10000, output: 1000 },
				})
			})

			const result = await runEffect(effect)
			// usableContext = 10000 - 1000 = 9000
			// percentage = round((150 / 9000) * 100) = round(1.667) = 2
			expect(result.percentage).toBe(2)
		})
	})

	describe("Model limit handling", () => {
		it("uses provided model limits", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
					},
					modelLimits: { context: 128000, output: 4096 },
				})
			})

			const result = await runEffect(effect)
			expect(result.limit).toBe(128000)
		})

		it("returns usable context for limit calculation", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
					},
					modelLimits: { context: 128000, output: 4096 },
				})
			})

			const result = await runEffect(effect)
			// usableContext = 128000 - 4096 = 123904
			expect(result.usableContext).toBe(123904)
		})
	})

	describe("Formatted output", () => {
		it("formats as '1.5K / 200.0K (1%)'", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.formatted).toBe("1.5K / 200.0K (1%)")
		})

		it("formats large numbers with M suffix", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1500000,
						output: 500000,
					},
					modelLimits: { context: 10000000, output: 100000 },
				})
			})

			const result = await runEffect(effect)
			// usableContext = 10000000 - 32000 = 9968000
			// percentage = round((2000000 / 9968000) * 100) = round(20.06) = 20
			expect(result.formatted).toBe("2.0M / 10.0M (20%)")
		})

		it("formats small numbers without suffix", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 100,
						output: 50,
					},
					modelLimits: { context: 500, output: 100 },
				})
			})

			const result = await runEffect(effect)
			// usableContext = 500 - 100 = 400
			// percentage = round((150 / 400) * 100) = round(37.5) = 38
			expect(result.formatted).toBe("150 / 500 (38%)")
		})
	})

	describe("Edge cases", () => {
		it("handles zero tokens", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 0,
						output: 0,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.used).toBe(0)
			expect(result.percentage).toBe(0)
			expect(result.formatted).toBe("0 / 200.0K (0%)")
		})

		it("handles at 100% usage", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 191808, // Exactly usableContext
						output: 0,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.percentage).toBe(100)
		})

		it("handles over 100% usage", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 250000,
						output: 0,
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			// usableContext = 191808
			// percentage = round((250000 / 191808) * 100) = round(130.3) = 130
			expect(result.percentage).toBeGreaterThan(100)
		})
	})

	describe("Token breakdown", () => {
		it("includes token breakdown in result", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(ContextService)
				return service.computeUsage({
					tokens: {
						input: 1000,
						output: 500,
						reasoning: 200,
						cache: { read: 300, write: 100 },
					},
					modelLimits: { context: 200000, output: 8192 },
				})
			})

			const result = await runEffect(effect)
			expect(result.tokens).toEqual({
				input: 1000,
				output: 500,
				cached: 300, // cache.read
			})
		})
	})
})
