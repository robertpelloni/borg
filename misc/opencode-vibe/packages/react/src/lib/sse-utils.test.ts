/**
 * Tests for SSE event filtering and state reduction utilities
 *
 * These are pure functions - NO React, NO DOM, NO renderHook.
 * Just pure logic with various inputs and expected outputs.
 */

import { describe, it, expect } from "vitest"
import { matchesEventType, matchesSessionId, extractEventItem } from "./sse-utils"
import type { GlobalEvent } from "../types/events"

describe("matchesEventType", () => {
	it("matches exact event type with string filter", () => {
		expect(matchesEventType("message.updated", "message.updated")).toBe(true)
	})

	it("does not match different event type with string filter", () => {
		expect(matchesEventType("message.removed", "message.updated")).toBe(false)
	})

	it("matches event type in array filter", () => {
		expect(matchesEventType("message.updated", ["message.updated", "message.removed"])).toBe(true)
	})

	it("does not match event type not in array filter", () => {
		expect(matchesEventType("session.updated", ["message.updated", "message.removed"])).toBe(false)
	})

	it("handles empty array filter", () => {
		expect(matchesEventType("message.updated", [])).toBe(false)
	})

	it("matches with single-element array filter", () => {
		expect(matchesEventType("message.updated", ["message.updated"])).toBe(true)
	})

	it("handles wildcard prefix matching", () => {
		expect(matchesEventType("message.updated", "message.*")).toBe(true)
		expect(matchesEventType("message.removed", "message.*")).toBe(true)
		expect(matchesEventType("session.updated", "message.*")).toBe(false)
	})

	it("handles wildcard in array", () => {
		expect(matchesEventType("compaction.started", ["compaction.*", "session.*"])).toBe(true)
		expect(matchesEventType("part.updated", ["compaction.*", "session.*"])).toBe(false)
	})
})

describe("matchesSessionId", () => {
	const createEvent = (sessionID?: string): GlobalEvent => ({
		directory: "/test",
		payload: {
			type: "message.updated",
			properties: { sessionID },
		},
	})

	it("matches when sessionId filter is undefined (no filtering)", () => {
		const event = createEvent("session-123")
		expect(matchesSessionId(event)).toBe(true)
	})

	it("matches when event sessionID matches filter", () => {
		const event = createEvent("session-123")
		expect(matchesSessionId(event, "session-123")).toBe(true)
	})

	it("does not match when event sessionID differs from filter", () => {
		const event = createEvent("session-123")
		expect(matchesSessionId(event, "session-456")).toBe(false)
	})

	it("does not match when event has no sessionID but filter is set", () => {
		const event = createEvent()
		expect(matchesSessionId(event, "session-123")).toBe(false)
	})

	it("matches when event has no sessionID and filter is undefined", () => {
		const event = createEvent()
		expect(matchesSessionId(event)).toBe(true)
	})

	it("handles properties being undefined", () => {
		const event: GlobalEvent = {
			directory: "/test",
			payload: {
				type: "message.updated",
				properties: {},
			},
		}
		expect(matchesSessionId(event, "session-123")).toBe(false)
		expect(matchesSessionId(event)).toBe(true)
	})
})

describe("extractEventItem", () => {
	it("extracts item from payload.properties.info", () => {
		const payload = {
			type: "message.updated",
			properties: {
				info: { id: "msg-123", text: "Hello" },
			},
		}
		expect(extractEventItem(payload)).toEqual({
			id: "msg-123",
			text: "Hello",
		})
	})

	it("extracts item from payload.properties.item", () => {
		const payload = {
			type: "part.updated",
			properties: {
				item: { id: "part-123", state: "running" },
			},
		}
		expect(extractEventItem(payload)).toEqual({
			id: "part-123",
			state: "running",
		})
	})

	it("extracts item from payload.properties.message", () => {
		const payload = {
			type: "message.updated",
			properties: {
				message: { id: "msg-456", sessionID: "sess-1" },
			},
		}
		expect(extractEventItem(payload)).toEqual({
			id: "msg-456",
			sessionID: "sess-1",
		})
	})

	it("returns undefined when no recognized property exists", () => {
		const payload = {
			type: "unknown.type",
			properties: {
				data: { id: "test" },
			},
		}
		expect(extractEventItem(payload)).toBeUndefined()
	})

	it("returns undefined when properties is undefined", () => {
		const payload = {
			type: "test",
			properties: {},
		}
		expect(extractEventItem(payload)).toBeUndefined()
	})

	it("handles missing properties gracefully", () => {
		const payload = {
			type: "test",
		}
		expect(extractEventItem(payload)).toBeUndefined()
	})

	it("prioritizes info over item over message", () => {
		const payload = {
			type: "test",
			properties: {
				info: { source: "info" },
				item: { source: "item" },
				message: { source: "message" },
			},
		}
		expect(extractEventItem(payload)).toEqual({ source: "info" })
	})

	it("falls back to item if info is missing", () => {
		const payload = {
			type: "test",
			properties: {
				item: { source: "item" },
				message: { source: "message" },
			},
		}
		expect(extractEventItem(payload)).toEqual({ source: "item" })
	})

	it("falls back to message if info and item are missing", () => {
		const payload = {
			type: "test",
			properties: {
				message: { source: "message" },
			},
		}
		expect(extractEventItem(payload)).toEqual({ source: "message" })
	})

	it("extracts item from payload.properties.part (message.part.updated events)", () => {
		const payload = {
			type: "message.part.updated",
			properties: {
				part: {
					id: "part-123",
					type: "tool",
					tool: "task",
					state: {
						status: "running",
						metadata: {
							summary: [{ id: "sub-1", tool: "read", state: { status: "completed" } }],
						},
					},
				},
			},
		}
		expect(extractEventItem(payload)).toEqual({
			id: "part-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running",
				metadata: {
					summary: [{ id: "sub-1", tool: "read", state: { status: "completed" } }],
				},
			},
		})
	})

	it("prioritizes info > item > part > message", () => {
		const payload = {
			type: "test",
			properties: {
				info: { source: "info" },
				item: { source: "item" },
				part: { source: "part" },
				message: { source: "message" },
			},
		}
		expect(extractEventItem(payload)).toEqual({ source: "info" })
	})

	it("falls back to part if info and item are missing", () => {
		const payload = {
			type: "message.part.updated",
			properties: {
				part: { source: "part" },
				message: { source: "message" },
			},
		}
		expect(extractEventItem(payload)).toEqual({ source: "part" })
	})
})
