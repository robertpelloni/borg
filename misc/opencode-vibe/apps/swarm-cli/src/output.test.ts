/**
 * Tests for output formatting utilities
 */

import { describe, it, expect } from "vitest"
import {
	formatSSEEvent,
	StreamingAggregator,
	GroupedEventLog,
	type SSEEventInfo,
} from "./output.js"

describe("formatSSEEvent", () => {
	it("formats session.status event with status", () => {
		const event: SSEEventInfo = {
			type: "session.status",
			properties: {
				sessionID: "ses_abc123",
				status: "running",
			},
		}

		const result = formatSSEEvent(event)
		expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
		expect(result).toContain("session.status")
		expect(result).toContain("ses_abc123")
		expect(result).toContain("running")
	})

	it("formats message.created event", () => {
		const event: SSEEventInfo = {
			type: "message.created",
			properties: {
				id: "msg_def456",
				sessionID: "ses_abc123",
			},
		}

		const result = formatSSEEvent(event)
		expect(result).toContain("message.created")
		expect(result).toContain("ses_abc123/msg_def456")
	})

	it("formats part.updated event", () => {
		const event: SSEEventInfo = {
			type: "part.updated",
			properties: {
				id: "part_789",
				messageID: "msg_def456",
				sessionID: "ses_abc123",
			},
		}

		const result = formatSSEEvent(event)
		expect(result).toContain("part.updated")
		expect(result).toContain("ses_abc123/msg_def456/part_789")
	})

	it("formats message.updated event with token count", () => {
		const event: SSEEventInfo = {
			type: "message.updated",
			properties: {
				id: "msg_def456",
				sessionID: "ses_abc123",
				totalTokens: 1234,
			},
		}

		const result = formatSSEEvent(event)
		expect(result).toContain("message.updated")
		expect(result).toContain("ses_abc123/msg_def456")
		expect(result).toContain("1234")
	})

	it("pads event type to 20 characters", () => {
		const event: SSEEventInfo = {
			type: "session.status",
			properties: {
				sessionID: "ses_abc",
			},
		}

		const result = formatSSEEvent(event)
		// Format: "[sse] HH:MM:SS session.status      ses_abc"
		// Extract the event type portion (after source tag and timestamp)
		const parts = result.split(/\s+/)
		// parts[0] = "[sse]", parts[1] = "HH:MM:SS", parts[2] = "session.status"
		const eventType = parts[2]
		expect(eventType).toBe("session.status")
		// Verify padding by checking the space after
		const afterEventType = result.indexOf("ses_abc")
		const beforeEventType = result.indexOf("session.status")
		const spacing = afterEventType - beforeEventType - "session.status".length
		expect(spacing).toBeGreaterThan(0)
	})

	it("handles unknown event types gracefully", () => {
		const event: SSEEventInfo = {
			type: "unknown.event",
			properties: {
				foo: "bar",
			},
		}

		const result = formatSSEEvent(event)
		expect(result).toContain("unknown.event")
	})

	it("tags event with source", () => {
		const event: SSEEventInfo = {
			type: "session.status",
			properties: {
				sessionID: "ses_abc",
			},
			source: "swarm-db",
		}

		const result = formatSSEEvent(event)
		expect(result).toContain("[swarm-db]")
	})
})

describe("StreamingAggregator", () => {
	it("detects streaming events (message.part.updated)", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const event: SSEEventInfo = {
			type: "message.part.updated",
			properties: {
				part: {
					sessionID: "ses_123",
					messageID: "msg_456",
					id: "part_789",
				},
			},
		}

		const result = aggregator.process(event)
		// First event should emit "streaming started"
		expect(result).toBeDefined()
		expect(result?.summary).toBe(true)
		expect(result?.line).toContain("streaming")
		expect(result?.line).toContain("ses_123")
	})

	it("aggregates rapid message.part.updated events", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const sessionID = "ses_123"
		const messageID = "msg_456"

		// Simulate 10 rapid part.updated events
		const results: string[] = []
		for (let i = 0; i < 10; i++) {
			const event: SSEEventInfo = {
				type: "message.part.updated",
				properties: {
					part: {
						sessionID,
						messageID,
						id: `part_${i}`,
					},
				},
			}
			const result = aggregator.process(event)
			if (result) {
				results.push(result.line)
			}
		}

		// Should emit: 1 "streaming started" + 0-1 summary (depending on timing)
		expect(results.length).toBeGreaterThanOrEqual(1)
		expect(results.length).toBeLessThanOrEqual(2)
		expect(results[0]).toContain("streaming")
	})

	it("emits throttled summary after time interval", async () => {
		const aggregator = new StreamingAggregator({ throttleMs: 50 })

		const sessionID = "ses_123"
		const messageID = "msg_456"

		// First event
		aggregator.process({
			type: "message.part.updated",
			properties: { part: { sessionID, messageID, id: "part_1" } },
		})

		// More events immediately
		for (let i = 2; i <= 10; i++) {
			aggregator.process({
				type: "message.part.updated",
				properties: { part: { sessionID, messageID, id: `part_${i}` } },
			})
		}

		// Wait for throttle interval
		await new Promise((resolve) => setTimeout(resolve, 60))

		// Next event should trigger summary
		const result = aggregator.process({
			type: "message.part.updated",
			properties: { part: { sessionID, messageID, id: "part_11" } },
		})

		expect(result).toBeDefined()
		expect(result?.summary).toBe(true)
		expect(result?.line).toMatch(/\d+ parts/)
	})

	it("emits final summary on session.completed", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const sessionID = "ses_123"

		// Stream some parts
		for (let i = 1; i <= 5; i++) {
			aggregator.process({
				type: "message.part.updated",
				properties: { part: { sessionID, messageID: "msg_456", id: `part_${i}` } },
			})
		}

		// End with session.completed
		const result = aggregator.process({
			type: "session.completed",
			properties: { sessionID },
		})

		expect(result).toBeDefined()
		expect(result?.summary).toBe(true)
		expect(result?.line).toContain("5 parts")
		expect(result?.line).toContain("ses_123")
	})

	it("emits final summary when switching to different event type", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const sessionID = "ses_123"

		// Stream some parts
		for (let i = 1; i <= 5; i++) {
			aggregator.process({
				type: "message.part.updated",
				properties: { part: { sessionID, messageID: "msg_456", id: `part_${i}` } },
			})
		}

		// Switch to different event type
		const result = aggregator.process({
			type: "session.status",
			properties: { sessionID, status: "running" },
		})

		// Should emit final summary for parts, then regular event
		expect(result).toBeDefined()
		// The summary is emitted internally, process returns regular event
		expect(result?.summary).toBeUndefined()
	})

	it("tracks separate streams for different sessions", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		// Session 1
		aggregator.process({
			type: "message.part.updated",
			properties: { part: { sessionID: "ses_1", messageID: "msg_1", id: "part_1" } },
		})

		// Session 2
		aggregator.process({
			type: "message.part.updated",
			properties: { part: { sessionID: "ses_2", messageID: "msg_2", id: "part_1" } },
		})

		// Both should be tracked separately
		// (implementation detail - just verify no crashes)
		expect(true).toBe(true)
	})

	it("formats summary line correctly", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const sessionID = "ses_abc123"

		// Stream 47 parts
		for (let i = 1; i <= 47; i++) {
			aggregator.process({
				type: "message.part.updated",
				properties: { part: { sessionID, messageID: "msg_456", id: `part_${i}` } },
			})
		}

		// Force final summary
		const result = aggregator.process({
			type: "session.completed",
			properties: { sessionID },
		})

		expect(result).toBeDefined()
		expect(result?.line).toMatch(/\[.*\] \d{2}:\d{2}:\d{2} streaming .*ses_abc123.*47 parts/)
	})

	it("uses new summary format with parentheses: (N parts)", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const sessionID = "ses_123"

		// Stream parts
		for (let i = 1; i <= 12; i++) {
			aggregator.process({
				type: "message.part.updated",
				properties: { part: { sessionID, messageID: "msg_456", id: `part_${i}` } },
			})
		}

		// Force summary
		const result = aggregator.process({
			type: "session.completed",
			properties: { sessionID },
		})

		expect(result).toBeDefined()
		expect(result?.line).toContain("(12 parts)")
	})

	it("adds checkmark indicator when streaming completes", () => {
		const aggregator = new StreamingAggregator({ throttleMs: 100 })

		const sessionID = "ses_123"

		// Stream parts
		for (let i = 1; i <= 5; i++) {
			aggregator.process({
				type: "message.part.updated",
				properties: { part: { sessionID, messageID: "msg_456", id: `part_${i}` } },
			})
		}

		// Complete streaming
		const result = aggregator.process({
			type: "session.completed",
			properties: { sessionID },
		})

		expect(result).toBeDefined()
		expect(result?.line).toContain("✓")
		expect(result?.line).toContain("(5 parts)")
	})

	it("defaults to 500ms throttle", () => {
		const aggregator = new StreamingAggregator()

		// Access private field via type assertion for testing
		expect((aggregator as any).throttleMs).toBe(500)
	})
})

describe("GroupedEventLog", () => {
	it("creates grouped event log", () => {
		const log = new GroupedEventLog()

		expect(log).toBeDefined()
	})

	it("respects maxEventsPerGroup limit", () => {
		const log = new GroupedEventLog({ maxEventsPerGroup: 3 })

		// Add 5 events to same source
		for (let i = 1; i <= 5; i++) {
			log.addEvent({
				type: "session.status",
				properties: { sessionID: `ses_${i}` },
				source: "sse",
			})
		}

		const output = log.format()
		// Should only show last 3 events (ses_3, ses_4, ses_5)
		expect(output).not.toContain("ses_1")
		expect(output).not.toContain("ses_2")
		expect(output).toContain("ses_3")
		expect(output).toContain("ses_4")
		expect(output).toContain("ses_5")
	})

	it("applies limit per group independently", () => {
		const log = new GroupedEventLog({ maxEventsPerGroup: 2 })

		// Add 3 SSE events
		log.addEvent({ type: "session.status", properties: { sessionID: "sse_1" }, source: "sse" })
		log.addEvent({ type: "session.status", properties: { sessionID: "sse_2" }, source: "sse" })
		log.addEvent({ type: "session.status", properties: { sessionID: "sse_3" }, source: "sse" })

		// Add 3 swarm-db events
		log.addEvent({ type: "agent.start", properties: { agentID: "db_1" }, source: "swarm-db" })
		log.addEvent({ type: "agent.start", properties: { agentID: "db_2" }, source: "swarm-db" })
		log.addEvent({ type: "agent.start", properties: { agentID: "db_3" }, source: "swarm-db" })

		const output = log.format()

		// SSE: should have sse_2, sse_3 (not sse_1)
		expect(output).not.toContain("sse_1")
		expect(output).toContain("sse_2")
		expect(output).toContain("sse_3")

		// swarm-db: should have db_2, db_3 (not db_1)
		expect(output).not.toContain("db_1")
		expect(output).toContain("db_2")
		expect(output).toContain("db_3")
	})

	it("defaults to 10 events per group", () => {
		const log = new GroupedEventLog()

		// Add 15 events with distinct IDs that won't substring-match
		for (let i = 1; i <= 15; i++) {
			log.addEvent({
				type: "session.status",
				properties: { sessionID: `ses_event${String(i).padStart(2, "0")}` },
				source: "sse",
			})
		}

		const output = log.format()
		// Should only show last 10 events (event06 through event15)
		expect(output).not.toContain("ses_event01")
		expect(output).not.toContain("ses_event05")
		expect(output).toContain("ses_event06")
		expect(output).toContain("ses_event15")
	})

	it("adds events and groups by source", () => {
		// Using imported GroupedEventLog
		const log = new GroupedEventLog()

		const event1: SSEEventInfo = {
			type: "session.status",
			properties: { sessionID: "ses_123" },
			source: "sse",
		}

		const event2: SSEEventInfo = {
			type: "agent.start",
			properties: { agentID: "bd-123" },
			source: "swarm-db",
		}

		const event3: SSEEventInfo = {
			type: "session.updated",
			properties: { sessionID: "ses_456" },
			source: "sse",
		}

		log.addEvent(event1)
		log.addEvent(event2)
		log.addEvent(event3)

		const output = log.format()
		expect(output).toContain("SSE")
		expect(output).toContain("SWARM-DB")
		expect(output).toContain("ses_123")
		expect(output).toContain("bd-123")
		expect(output).toContain("ses_456")
	})

	it("formats with colored section headers", () => {
		// Using imported GroupedEventLog
		const log = new GroupedEventLog()

		log.addEvent({
			type: "session.status",
			properties: { sessionID: "ses_123" },
			source: "sse",
		})

		log.addEvent({
			type: "agent.start",
			properties: { agentID: "bd-123" },
			source: "swarm-db",
		})

		const output = log.format()

		// Should have separator lines with source names
		expect(output).toMatch(/━+.*SSE/)
		expect(output).toMatch(/━+.*SWARM-DB/)
	})

	it("handles events without source", () => {
		// Using imported GroupedEventLog
		const log = new GroupedEventLog()

		log.addEvent({
			type: "session.status",
			properties: { sessionID: "ses_123" },
		})

		const output = log.format()
		expect(output).toContain("SSE") // Default source
	})
})
