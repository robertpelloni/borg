/**
 * Tests for SSE status normalization
 *
 * The backend sends status in multiple formats across different SSE events.
 * This utility normalizes all known formats to canonical SessionStatus.
 */

import { describe, expect, it } from "vitest"
import { normalizeStatus } from "./normalize-status.js"

describe("normalizeStatus", () => {
	describe("canonical formats", () => {
		it('returns "running" for "running" string', () => {
			expect(normalizeStatus("running")).toBe("running")
		})

		it('returns "completed" for "completed" string', () => {
			expect(normalizeStatus("completed")).toBe("completed")
		})
	})

	describe("legacy string formats", () => {
		it('normalizes "pending" to "running"', () => {
			expect(normalizeStatus("pending")).toBe("running")
		})

		it('normalizes "active" to "running"', () => {
			expect(normalizeStatus("active")).toBe("running")
		})

		it('normalizes "done" to "completed"', () => {
			expect(normalizeStatus("done")).toBe("completed")
		})

		it('normalizes "idle" to "completed"', () => {
			expect(normalizeStatus("idle")).toBe("completed")
		})

		it('normalizes "error" to "completed"', () => {
			expect(normalizeStatus("error")).toBe("completed")
		})
	})

	describe("object formats (BackendSessionStatus and { type: string })", () => {
		it('normalizes { type: "running" } to "running"', () => {
			expect(normalizeStatus({ type: "running" })).toBe("running")
		})

		it('normalizes { type: "completed" } to "completed"', () => {
			expect(normalizeStatus({ type: "completed" })).toBe("completed")
		})

		it('normalizes { type: "idle" } to "completed"', () => {
			expect(normalizeStatus({ type: "idle" })).toBe("completed")
		})

		it('normalizes { type: "busy" } to "running"', () => {
			expect(normalizeStatus({ type: "busy" })).toBe("running")
		})

		it('normalizes { type: "retry" } to "running"', () => {
			expect(
				normalizeStatus({
					type: "retry",
					attempt: 1,
					message: "retrying",
					next: 1000,
				}),
			).toBe("running")
		})

		it('normalizes { type: "pending" } to "running"', () => {
			expect(normalizeStatus({ type: "pending" })).toBe("running")
		})

		it('normalizes { type: "active" } to "running"', () => {
			expect(normalizeStatus({ type: "active" })).toBe("running")
		})

		it('normalizes { type: "done" } to "completed"', () => {
			expect(normalizeStatus({ type: "done" })).toBe("completed")
		})
	})

	describe("boolean formats", () => {
		it('normalizes true (isRunning) to "running"', () => {
			expect(normalizeStatus(true)).toBe("running")
		})

		it('normalizes false (isRunning) to "completed"', () => {
			expect(normalizeStatus(false)).toBe("completed")
		})
	})

	describe("edge cases", () => {
		it('defaults to "completed" for null', () => {
			expect(normalizeStatus(null)).toBe("completed")
		})

		it('defaults to "completed" for undefined', () => {
			expect(normalizeStatus(undefined)).toBe("completed")
		})

		it('defaults to "completed" for empty string', () => {
			expect(normalizeStatus("")).toBe("completed")
		})

		it('defaults to "completed" for unknown string', () => {
			expect(normalizeStatus("unknown")).toBe("completed")
		})

		it('defaults to "completed" for unknown object', () => {
			expect(normalizeStatus({ type: "unknown" })).toBe("completed")
		})

		it('defaults to "completed" for number', () => {
			expect(normalizeStatus(123)).toBe("completed")
		})

		it('defaults to "completed" for array', () => {
			expect(normalizeStatus([])).toBe("completed")
		})

		it('defaults to "completed" for empty object', () => {
			expect(normalizeStatus({})).toBe("completed")
		})
	})

	describe("case insensitivity (defensive)", () => {
		it('normalizes "RUNNING" to "running"', () => {
			expect(normalizeStatus("RUNNING")).toBe("running")
		})

		it('normalizes "Completed" to "completed"', () => {
			expect(normalizeStatus("Completed")).toBe("completed")
		})

		it('normalizes "ACTIVE" to "running"', () => {
			expect(normalizeStatus("ACTIVE")).toBe("running")
		})

		it('normalizes "Done" to "completed"', () => {
			expect(normalizeStatus("Done")).toBe("completed")
		})
	})
})
