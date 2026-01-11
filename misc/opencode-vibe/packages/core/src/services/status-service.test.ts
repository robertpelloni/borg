/**
 * StatusService tests
 *
 * Tests the three-source session status logic:
 * 1. sessionStatus map (from SSE events)
 * 2. Sub-agent activity (Task parts)
 * 3. Last message check (bootstrap edge case)
 */

import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { StatusService } from "./status-service.js"
import type { SessionStatus } from "../types/events.js"

/**
 * Helper to run Effect and extract result
 */
async function runEffect<A>(effect: Effect.Effect<A, never, StatusService>): Promise<A> {
	return Effect.runPromise(Effect.provide(effect, StatusService.Default))
}

describe("StatusService", () => {
	describe("Source 1: sessionStatus map (highest priority)", () => {
		it("returns 'running' when sessionStatus map has running status", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "running" },
					messages: [],
					parts: [],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("running")
		})

		it("returns 'completed' when sessionStatus map has completed status", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "completed" },
					messages: [],
					parts: [],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed")
		})

		it("falls through when session not in sessionStatus map", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {}, // Empty map
					messages: [],
					parts: [],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed") // Default fallback
		})
	})

	describe("Source 2: Sub-agent activity", () => {
		it("returns 'running' when task part has running status", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "completed" }, // Completed in map
					messages: [{ id: "msg-1", role: "assistant" }],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "task",
							state: { status: "running" },
						},
					],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("running") // Sub-agent overrides completed status
		})

		it("ignores non-task parts", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "completed" },
					messages: [{ id: "msg-1", role: "assistant" }],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "other-tool",
							state: { status: "running" },
						},
					],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed") // Only task parts count
		})

		it("ignores task parts with non-running status", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "completed" },
					messages: [{ id: "msg-1", role: "assistant" }],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "task",
							state: { status: "completed" },
						},
					],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed") // Only running task parts count
		})

		it("can be disabled via options", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "completed" },
					messages: [{ id: "msg-1", role: "assistant" }],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "task",
							state: { status: "running" },
						},
					],
					options: { includeSubAgents: false },
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed") // Sub-agent check disabled
		})
	})

	describe("Source 3: Last message check (bootstrap edge case)", () => {
		it("returns 'running' when last message is assistant without completed time", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {},
					messages: [
						{ id: "msg-1", role: "user" },
						{
							id: "msg-2",
							role: "assistant",
							time: { created: 123 }, // No completed time
						},
					],
					parts: [],
					options: { includeLastMessage: true },
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("running")
		})

		it("returns 'completed' when last message is assistant with completed time", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {},
					messages: [
						{ id: "msg-1", role: "user" },
						{
							id: "msg-2",
							role: "assistant",
							time: { created: 123, completed: 456 },
						},
					],
					parts: [],
					options: { includeLastMessage: true },
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed")
		})

		it("is disabled by default", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {},
					messages: [
						{ id: "msg-1", role: "user" },
						{
							id: "msg-2",
							role: "assistant",
							time: { created: 123 }, // No completed time
						},
					],
					parts: [],
					// No options - includeLastMessage defaults to false
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed") // Last message check disabled by default
		})
	})

	describe("Priority order", () => {
		it("sessionStatus 'running' takes priority over everything", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "running" },
					messages: [
						{
							id: "msg-1",
							role: "assistant",
							time: { created: 123, completed: 456 },
						},
					],
					parts: [],
					options: { includeLastMessage: true },
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("running") // Map status wins
		})

		it("sub-agent activity takes priority over last message check", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: { "ses-123": "completed" },
					messages: [
						{
							id: "msg-1",
							role: "assistant",
							time: { created: 123, completed: 456 }, // Completed
						},
					],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "task",
							state: { status: "running" },
						},
					],
					options: { includeLastMessage: true },
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("running") // Sub-agent wins over last message
		})
	})

	describe("Edge cases", () => {
		it("handles empty messages array", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {},
					messages: [],
					parts: [],
					options: { includeLastMessage: true },
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed")
		})

		it("handles parts for different messages", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {},
					messages: [
						{ id: "msg-1", role: "assistant" },
						{ id: "msg-2", role: "user" },
					],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "task",
							state: { status: "running" },
						},
						{
							messageId: "msg-2",
							type: "text",
						},
					],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("running") // Finds running task in msg-1 parts
		})

		it("handles missing state in parts", async () => {
			const effect = Effect.gen(function* (_) {
				const service = yield* _(StatusService)
				return service.computeStatus({
					sessionId: "ses-123",
					sessionStatusMap: {},
					messages: [{ id: "msg-1", role: "assistant" }],
					parts: [
						{
							messageId: "msg-1",
							type: "tool",
							tool: "task",
							// No state field
						},
					],
				})
			})

			const result = await runEffect(effect)
			expect(result).toBe("completed") // Handles missing state gracefully
		})
	})
})
