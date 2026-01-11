/**
 * useWorldSession Tests - TDD approach
 *
 * Tests written FIRST before implementation.
 * Validates single session selector derived from useWorld().
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useWorldSession } from "./use-world-session.js"
import type { EnrichedSession, WorldState } from "@opencode-vibe/core/world"

// Mock useWorld
vi.mock("./use-world.js", () => ({
	useWorld: vi.fn(),
}))

const useWorld = vi.mocked(await import("./use-world.js").then((m) => m.useWorld))

describe("useWorldSession", () => {
	const now = Date.now()

	const mockSession1: EnrichedSession = {
		id: "session-1",
		title: "Test Session 1",
		directory: "/path/to/project",
		time: {
			created: now - 3600000,
			updated: now,
		},
		status: "running",
		isActive: true,
		messages: [],
		unreadCount: 0,
		contextUsagePercent: 45,
		lastActivityAt: now,
	}

	const mockSession2: EnrichedSession = {
		id: "session-2",
		title: "Test Session 2",
		directory: "/path/to/other",
		time: {
			created: now - 7200000,
			updated: now - 1800000,
		},
		status: "idle",
		isActive: false,
		messages: [],
		unreadCount: 2,
		contextUsagePercent: 10,
		lastActivityAt: now - 1800000,
	}

	const mockWorldState: WorldState = {
		sessions: [mockSession1, mockSession2],
		activeSessionCount: 1,
		activeSession: mockSession1,
		connectionStatus: "connected",
		lastUpdated: Date.now(),
		byDirectory: new Map([
			["/path/to/project", [mockSession1]],
			["/path/to/other", [mockSession2]],
		]),
		stats: { total: 2, active: 1, streaming: 0 },
	}

	beforeEach(() => {
		vi.clearAllMocks()
		// Default: return mock world state
		useWorld.mockReturnValue(mockWorldState)
	})

	it("returns EnrichedSession | null type", () => {
		const { result } = renderHook(() => useWorldSession("session-1"))

		// Should return a session object or null
		expect(result.current === null || typeof result.current === "object").toBe(true)
	})

	it("returns null when session not found", () => {
		const { result } = renderHook(() => useWorldSession("non-existent-session"))

		expect(result.current).toBeNull()
	})

	it("returns session when found by ID", () => {
		const { result } = renderHook(() => useWorldSession("session-1"))

		expect(result.current).toEqual(mockSession1)
		expect(result.current?.id).toBe("session-1")
		expect(result.current?.status).toBe("running")
	})

	it("returns different session when ID changes", () => {
		const { result } = renderHook(() => useWorldSession("session-2"))

		expect(result.current).toEqual(mockSession2)
		expect(result.current?.id).toBe("session-2")
		expect(result.current?.status).toBe("idle")
	})

	it("updates when world state changes", () => {
		const { result, rerender } = renderHook(() => useWorldSession("session-1"))

		// Initial state
		expect(result.current?.contextUsagePercent).toBe(45)

		// Update world state
		const updatedSession: EnrichedSession = {
			...mockSession1,
			contextUsagePercent: 75,
		}

		const updatedWorldState: WorldState = {
			...mockWorldState,
			sessions: [updatedSession, mockSession2],
		}

		useWorld.mockReturnValue(updatedWorldState)

		// Force re-render
		rerender()

		// Should reflect updated state
		expect(result.current?.contextUsagePercent).toBe(75)
	})

	it("returns null when session is removed from world state", () => {
		const { result, rerender } = renderHook(() => useWorldSession("session-1"))

		// Initial state - session exists
		expect(result.current).toEqual(mockSession1)

		// Remove session from world state
		const updatedWorldState: WorldState = {
			...mockWorldState,
			sessions: [mockSession2], // session-1 removed
			activeSessionCount: 0,
			activeSession: null,
		}

		useWorld.mockReturnValue(updatedWorldState)

		// Force re-render
		rerender()

		// Should return null
		expect(result.current).toBeNull()
	})

	it("memoizes result to prevent unnecessary re-renders", () => {
		const { result, rerender } = renderHook(() => useWorldSession("session-1"))

		const firstResult = result.current

		// Re-render without changing world state
		rerender()

		// Should return same reference (memoized)
		expect(result.current).toBe(firstResult)
	})

	it("updates memoized result when sessionId changes", () => {
		let sessionId = "session-1"
		const { result, rerender } = renderHook(() => useWorldSession(sessionId))

		expect(result.current?.id).toBe("session-1")

		// Change sessionId
		sessionId = "session-2"
		rerender()

		expect(result.current?.id).toBe("session-2")
	})

	it("returns same reference when sessions array identity changes but content is same", () => {
		const { result, rerender } = renderHook(() => useWorldSession("session-1"))

		const firstResult = result.current

		// Change sessions array (new reference, same content)
		const newWorldState: WorldState = {
			...mockWorldState,
			sessions: [...mockWorldState.sessions], // new array reference
		}

		useWorld.mockReturnValue(newWorldState)
		rerender()

		// useMemo will recompute because sessions array reference changed,
		// but the found session object should be the same instance
		expect(result.current).toBe(firstResult)
		expect(result.current).toEqual(mockSession1)
	})
})
