/**
 * WorldState Formatting Tests
 */

import { describe, it, expect } from "vitest"
import { formatWorldState } from "./world-state"
import type { WorldState, EnrichedSession } from "@opencode-vibe/core/world"

function createMockSession(overrides: Partial<EnrichedSession> = {}): EnrichedSession {
	return {
		id: overrides.id || "test-session-12345678",
		title: overrides.title || "Test Session",
		directory: overrides.directory || "/Users/test/project",
		time: overrides.time || { created: Date.now(), updated: Date.now() },
		status: (overrides.status || "idle") as any,
		isActive: overrides.isActive ?? false,
		lastActivityAt: overrides.lastActivityAt || Date.now(),
		messages: overrides.messages || [],
		unreadCount: overrides.unreadCount || 0,
		contextUsagePercent: overrides.contextUsagePercent || 0,
		...overrides,
	} as EnrichedSession
}

function createMockWorldState(
	sessions: EnrichedSession[] = [],
	overrides: Partial<WorldState> = {},
): WorldState {
	const byDirectory = new Map<string, EnrichedSession[]>()
	for (const session of sessions) {
		const existing = byDirectory.get(session.directory) || []
		byDirectory.set(session.directory, [...existing, session])
	}

	const activeSessionCount = sessions.filter((s) => s.isActive).length
	const activeSession = sessions.find((s) => s.isActive) || null

	return {
		sessions,
		byDirectory,
		stats: {
			total: sessions.length,
			active: sessions.filter((s) => s.isActive).length,
			streaming: sessions.filter((s) => s.messages.some((m) => m.isStreaming)).length,
		},
		activeSessionCount,
		activeSession,
		connectionStatus: "connected",
		lastUpdated: Date.now(),
		...overrides,
	} as WorldState
}

describe("formatWorldState", () => {
	describe("change detection", () => {
		it("shows no indicators when prevState is undefined (first render)", () => {
			const session = createMockSession({
				id: "abc12345",
				messages: [{ id: "msg1" } as any],
			})
			const state = createMockWorldState([session])

			const output = formatWorldState(state)

			expect(output).not.toContain("NEW")
			expect(output).not.toContain("UPDATED")
		})

		it("shows NEW indicator for sessions not in prevState", () => {
			const session = createMockSession({
				id: "abc12345",
				messages: [{ id: "msg1" } as any],
			})
			const state = createMockWorldState([session])
			const prevState = createMockWorldState([])

			const output = formatWorldState(state, prevState)

			expect(output).toContain("← NEW")
		})

		it("shows UPDATED indicator when message count changes", () => {
			const sessionOld = createMockSession({
				id: "abc12345",
				messages: [{ id: "msg1" } as any],
			})
			const sessionNew = createMockSession({
				id: "abc12345",
				messages: [{ id: "msg1" } as any, { id: "msg2" } as any],
			})
			const prevState = createMockWorldState([sessionOld])
			const state = createMockWorldState([sessionNew])

			const output = formatWorldState(state, prevState)

			expect(output).toContain("← UPDATED")
		})

		it("shows no indicator for unchanged sessions", () => {
			const session = createMockSession({
				id: "abc12345",
				messages: [{ id: "msg1" } as any],
			})
			const prevState = createMockWorldState([session])
			const state = createMockWorldState([session])

			const output = formatWorldState(state, prevState)

			// Should have session ID but no change indicators
			expect(output).toContain("abc12345")
			expect(output).not.toContain("← NEW")
			expect(output).not.toContain("← UPDATED")
		})

		it("handles mixed changes correctly", () => {
			const unchangedSession = createMockSession({
				id: "aaaaaaaa-unchanged1",
				messages: [{ id: "msg1" } as any],
				lastActivityAt: Date.now() - 1000, // oldest
			})
			const updatedSessionOld = createMockSession({
				id: "bbbbbbbb-updated123",
				messages: [{ id: "msg1" } as any],
				lastActivityAt: Date.now() - 500, // middle
			})
			const updatedSessionNew = createMockSession({
				id: "bbbbbbbb-updated123",
				messages: [{ id: "msg1" } as any, { id: "msg2" } as any],
				lastActivityAt: Date.now() - 500, // middle
			})
			const newSession = createMockSession({
				id: "cccccccc-new45678",
				messages: [{ id: "msg1" } as any],
				lastActivityAt: Date.now(), // newest
			})

			const prevState = createMockWorldState([unchangedSession, updatedSessionOld])
			const state = createMockWorldState([unchangedSession, updatedSessionNew, newSession])

			const output = formatWorldState(state, prevState)

			// Verify each session has correct indicator (using last 8 chars of ID)
			const lines = output.split("\n")
			const unchangedLine = lines.find((l) => l.includes("hanged1"))
			const updatedLine = lines.find((l) => l.includes("dated123"))
			const newLine = lines.find((l) => l.includes("w45678"))

			expect(unchangedLine).toBeDefined()
			expect(unchangedLine).not.toContain("← NEW")
			expect(unchangedLine).not.toContain("← UPDATED")

			expect(updatedLine).toBeDefined()
			expect(updatedLine).toContain("← UPDATED")

			expect(newLine).toBeDefined()
			expect(newLine).toContain("← NEW")
		})
	})
})
