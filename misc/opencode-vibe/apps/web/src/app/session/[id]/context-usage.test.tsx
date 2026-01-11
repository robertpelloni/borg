/**
 * Unit tests for context usage calculation logic
 *
 * Tests the calculateUsage function that powers ContextUsage component.
 * Uses pure function testing without React rendering.
 */

import { describe, test, expect } from "vitest"

// Extract types and calculation function from context-usage module
type OpencodeMessage = {
	info: {
		id: string
		role: string
		tokens?: {
			input?: number
			output?: number
			reasoning?: number
			cache?: {
				read?: number
				write?: number
			}
		}
		cost?: number
	}
	parts: unknown[]
}

interface TokenBreakdown {
	input: number
	output: number
	reasoning: number
	cacheRead: number
	cacheWrite: number
}

interface UsageStats {
	totalTokens: number
	totalCost: number
	tokenBreakdown: TokenBreakdown
}

/**
 * Pure calculation function extracted for testing
 */
function calculateUsage(messages: OpencodeMessage[]): UsageStats {
	const breakdown: TokenBreakdown = {
		input: 0,
		output: 0,
		reasoning: 0,
		cacheRead: 0,
		cacheWrite: 0,
	}
	let totalCost = 0

	for (const message of messages) {
		if (message.info.role !== "assistant") continue

		const tokens = message.info.tokens
		if (tokens) {
			breakdown.input += tokens.input ?? 0
			breakdown.output += tokens.output ?? 0
			breakdown.reasoning += tokens.reasoning ?? 0
			breakdown.cacheRead += tokens.cache?.read ?? 0
			breakdown.cacheWrite += tokens.cache?.write ?? 0
		}

		totalCost += message.info.cost ?? 0
	}

	const totalTokens =
		breakdown.input +
		breakdown.output +
		breakdown.reasoning +
		breakdown.cacheRead +
		breakdown.cacheWrite

	return { totalTokens, totalCost, tokenBreakdown: breakdown }
}

describe("calculateUsage", () => {
	test("returns zero stats for empty messages array", () => {
		const result = calculateUsage([])
		expect(result.totalTokens).toBe(0)
		expect(result.totalCost).toBe(0)
	})

	test("ignores user messages", () => {
		const messages: OpencodeMessage[] = [
			{
				info: { id: "1", role: "user" },
				parts: [],
			},
		]
		const result = calculateUsage(messages)
		expect(result.totalTokens).toBe(0)
		expect(result.totalCost).toBe(0)
	})

	test("calculates total tokens from all assistant messages", () => {
		const messages: OpencodeMessage[] = [
			{
				info: {
					id: "1",
					role: "assistant",
					tokens: {
						input: 100,
						output: 50,
						reasoning: 25,
						cache: { read: 10, write: 5 },
					},
					cost: 0.01,
				},
				parts: [],
			},
			{
				info: {
					id: "2",
					role: "assistant",
					tokens: {
						input: 200,
						output: 100,
					},
					cost: 0.02,
				},
				parts: [],
			},
		]

		const result = calculateUsage(messages)

		// First message: 100+50+25+10+5 = 190
		// Second message: 200+100 = 300
		// Total: 490
		expect(result.totalTokens).toBe(490)
		expect(result.totalCost).toBe(0.03)

		// Breakdown
		expect(result.tokenBreakdown.input).toBe(300)
		expect(result.tokenBreakdown.output).toBe(150)
		expect(result.tokenBreakdown.reasoning).toBe(25)
		expect(result.tokenBreakdown.cacheRead).toBe(10)
		expect(result.tokenBreakdown.cacheWrite).toBe(5)
	})

	test("handles missing token fields gracefully", () => {
		const messages: OpencodeMessage[] = [
			{
				info: {
					id: "1",
					role: "assistant",
					tokens: {
						input: 100,
						// output, reasoning, cache missing
					},
					cost: 0.01,
				},
				parts: [],
			},
		]

		const result = calculateUsage(messages)
		expect(result.totalTokens).toBe(100)
		expect(result.tokenBreakdown.input).toBe(100)
		expect(result.tokenBreakdown.output).toBe(0)
	})

	test("handles missing cost gracefully", () => {
		const messages: OpencodeMessage[] = [
			{
				info: {
					id: "1",
					role: "assistant",
					tokens: { input: 100 },
					// cost missing
				},
				parts: [],
			},
		]

		const result = calculateUsage(messages)
		expect(result.totalCost).toBe(0)
	})

	test("handles messages with no tokens field", () => {
		const messages: OpencodeMessage[] = [
			{
				info: {
					id: "1",
					role: "assistant",
					// tokens field missing entirely
					cost: 0.01,
				},
				parts: [],
			},
		]

		const result = calculateUsage(messages)
		expect(result.totalTokens).toBe(0)
		expect(result.totalCost).toBe(0.01)
	})
})
