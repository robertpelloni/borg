import { describe, expect, it } from "vitest"
import { Schema as S } from "effect"
import { WorldEvent } from "./events.js"

describe("WorldEvent", () => {
	describe("session events", () => {
		it("should decode session.created", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "session.created",
				offset: "12345",
				timestamp: 1234567890,
				upToDate: false,
				payload: {
					id: "session-123",
					projectKey: "/path/to/project",
				},
			})

			expect(event.type).toBe("session.created")
			expect(event.offset).toBe("12345")
			expect(event.upToDate).toBe(false)
		})

		it("should decode session.updated", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "session.updated",
				offset: "12346",
				timestamp: 1234567891,
				upToDate: false,
				payload: {
					id: "session-123",
					status: "active",
				},
			})

			expect(event.type).toBe("session.updated")
		})

		it("should decode session.completed", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "session.completed",
				offset: "12347",
				timestamp: 1234567892,
				upToDate: true,
				payload: {
					id: "session-123",
					exitCode: 0,
				},
			})

			expect(event.type).toBe("session.completed")
			expect(event.upToDate).toBe(true)
		})
	})

	describe("worker events", () => {
		it("should decode worker.spawned", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "worker.spawned",
				offset: "12350",
				timestamp: 1234567900,
				upToDate: false,
				payload: {
					workerId: "worker-123",
					taskId: "task-456",
				},
			})

			expect(event.type).toBe("worker.spawned")
		})

		it("should decode worker.progress", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "worker.progress",
				offset: "12351",
				timestamp: 1234567901,
				upToDate: false,
				payload: {
					workerId: "worker-123",
					percent: 50,
				},
			})

			expect(event.type).toBe("worker.progress")
		})

		it("should decode worker.completed", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "worker.completed",
				offset: "12352",
				timestamp: 1234567902,
				upToDate: false,
				payload: {
					workerId: "worker-123",
					success: true,
				},
			})

			expect(event.type).toBe("worker.completed")
		})

		it("should decode worker.failed", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "worker.failed",
				offset: "12353",
				timestamp: 1234567903,
				upToDate: false,
				payload: {
					workerId: "worker-123",
					error: "Something went wrong",
				},
			})

			expect(event.type).toBe("worker.failed")
		})
	})

	describe("message events", () => {
		it("should decode message.sent", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "message.sent",
				offset: "12360",
				timestamp: 1234567910,
				upToDate: false,
				payload: {
					messageId: "msg-123",
					from: "agent-1",
					to: "agent-2",
				},
			})

			expect(event.type).toBe("message.sent")
		})

		it("should decode message.received", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "message.received",
				offset: "12361",
				timestamp: 1234567911,
				upToDate: false,
				payload: {
					messageId: "msg-123",
					recipient: "agent-2",
				},
			})

			expect(event.type).toBe("message.received")
		})
	})

	describe("reservation events", () => {
		it("should decode reservation.acquired", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "reservation.acquired",
				offset: "12370",
				timestamp: 1234567920,
				upToDate: false,
				payload: {
					reservationId: "res-123",
					agentId: "agent-1",
					path: "src/file.ts",
				},
			})

			expect(event.type).toBe("reservation.acquired")
		})

		it("should decode reservation.released", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "reservation.released",
				offset: "12371",
				timestamp: 1234567921,
				upToDate: false,
				payload: {
					reservationId: "res-123",
				},
			})

			expect(event.type).toBe("reservation.released")
		})
	})

	describe("discriminated union", () => {
		it("should enforce type discrimination", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "session.created",
				offset: "12345",
				timestamp: 1234567890,
				upToDate: false,
				payload: { id: "session-123", projectKey: "/path" },
			})

			if (event.type === "session.created") {
				expect(event.payload).toHaveProperty("id")
				expect(event.payload).toHaveProperty("projectKey")
			}
		})

		it("should reject unknown event types", () => {
			expect(() =>
				S.decodeSync(WorldEvent)({
					// @ts-expect-error - testing runtime validation
					type: "unknown.event",
					offset: "12345",
					timestamp: 1234567890,
					upToDate: false,
					// @ts-expect-error - testing runtime validation
					payload: {},
				}),
			).toThrow()
		})

		it("should reject missing required fields", () => {
			expect(() =>
				S.decodeSync(WorldEvent)({
					type: "session.created",
					offset: "12345",
					timestamp: 1234567890,
					// @ts-expect-error - testing runtime validation - missing upToDate
					payload: { id: "session-123" },
				}),
			).toThrow()
		})
	})

	describe("upToDate signal", () => {
		it("should validate boolean upToDate", () => {
			expect(() =>
				S.decodeSync(WorldEvent)({
					type: "session.created",
					offset: "12345",
					timestamp: 1234567890,
					// @ts-expect-error - testing runtime validation
					upToDate: "true", // should be boolean
					payload: { id: "session-123", projectKey: "/path" },
				}),
			).toThrow()
		})

		it("should allow upToDate=true for last event in catch-up", () => {
			const event = S.decodeSync(WorldEvent)({
				type: "session.created",
				offset: "12345",
				timestamp: 1234567890,
				upToDate: true,
				payload: { id: "session-123", projectKey: "/path" },
			})

			expect(event.upToDate).toBe(true)
		})
	})
})
