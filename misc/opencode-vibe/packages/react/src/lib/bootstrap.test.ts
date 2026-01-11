/**
 * Bootstrap utilities tests
 *
 * Tests retry logic with exponential backoff and fallback defaults
 * for the bootstrap phase (model limits fetch).
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import { fetchModelLimitsWithRetry, DEFAULT_MODEL_LIMITS } from "./bootstrap"

describe("DEFAULT_MODEL_LIMITS", () => {
	it("has reasonable context limit (128k tokens)", () => {
		expect(DEFAULT_MODEL_LIMITS.context).toBe(128000)
	})

	it("has reasonable output limit (4k tokens)", () => {
		expect(DEFAULT_MODEL_LIMITS.output).toBe(4096)
	})
})

describe("fetchModelLimitsWithRetry", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("returns model limits on first success", async () => {
		const mockLimits = {
			"gpt-4": { context: 8000, output: 2000 },
			"claude-3": { context: 200000, output: 4096 },
		}

		const fetchFn = vi.fn().mockResolvedValue(mockLimits)

		const result = await fetchModelLimitsWithRetry(fetchFn)

		expect(result).toEqual(mockLimits)
		expect(fetchFn).toHaveBeenCalledTimes(1)
	})

	it("retries on failure and eventually succeeds", async () => {
		const mockLimits = {
			"gpt-4": { context: 8000, output: 2000 },
		}

		// Fail twice, succeed on third attempt
		const fetchFn = vi
			.fn()
			.mockRejectedValueOnce(new Error("Network error"))
			.mockRejectedValueOnce(new Error("Timeout"))
			.mockResolvedValueOnce(mockLimits)

		const result = await fetchModelLimitsWithRetry(fetchFn)

		expect(result).toEqual(mockLimits)
		expect(fetchFn).toHaveBeenCalledTimes(3)
	})

	it("returns empty object after max retries (3 attempts)", async () => {
		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		// All attempts fail
		const fetchFn = vi.fn().mockRejectedValue(new Error("Persistent failure"))

		const result = await fetchModelLimitsWithRetry(fetchFn)

		expect(result).toEqual({})
		expect(fetchFn).toHaveBeenCalledTimes(3)

		// Should warn user
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining("[OpenCode] Failed to load model limits"),
			expect.anything(), // error message
		)
	})

	it("logs debug info for retry attempts", async () => {
		const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {})

		const fetchFn = vi.fn().mockRejectedValueOnce(new Error("Fail 1")).mockResolvedValueOnce({})

		await fetchModelLimitsWithRetry(fetchFn)

		// Should log retry attempt with delay and attempt count
		expect(consoleDebugSpy).toHaveBeenCalledWith(
			expect.stringContaining("[OpenCode] Retrying model limits fetch"),
			expect.anything(),
		)
		expect(consoleDebugSpy).toHaveBeenCalledWith(
			expect.stringMatching(/attempt 1\/3.*1000ms/),
			expect.anything(),
		)
	})

	it("uses exponential backoff delays (1s, 2s)", async () => {
		const timestamps: number[] = []
		const fetchFn = vi.fn().mockImplementation(async () => {
			timestamps.push(Date.now())
			throw new Error("Fail")
		})

		await fetchModelLimitsWithRetry(fetchFn)

		// Should have made 3 attempts
		expect(timestamps).toHaveLength(3)

		// Verify delays are approximately exponential (±200ms tolerance for execution time)
		const delay1 = timestamps[1] - timestamps[0]
		const delay2 = timestamps[2] - timestamps[1]

		expect(delay1).toBeGreaterThanOrEqual(900) // ~1s
		expect(delay1).toBeLessThanOrEqual(1200)

		expect(delay2).toBeGreaterThanOrEqual(1900) // ~2s
		expect(delay2).toBeLessThanOrEqual(2200)
	})
})
