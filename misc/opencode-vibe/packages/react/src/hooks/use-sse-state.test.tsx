import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { multiServerSSE } from "@opencode-vibe/core/sse"

/**
 * useSSEState Hook Tests
 *
 * Testing strategy: Test the underlying observable pattern directly
 * (multiServerSSE.onStateChange) rather than React rendering.
 * This avoids DOM testing and follows TDD principles from testing-patterns skill.
 *
 * The hook is a thin wrapper around multiServerSSE.getCurrentState() +
 * multiServerSSE.onStateChange(), so we test those APIs directly.
 */

describe("useSSEState observable behavior", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		// Ensure clean state
		multiServerSSE.stop()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
		multiServerSSE.stop()
	})

	it("getCurrentState() returns initial empty state for hook initialization", () => {
		const initialState = multiServerSSE.getCurrentState()

		expect(initialState).toEqual({
			servers: [],
			connections: [],
			discovering: false,
			connected: false,
		})
	})

	it("onStateChange() provides reactive updates hook can subscribe to", async () => {
		const stateUpdates: unknown[] = []
		const unsubscribe = multiServerSSE.onStateChange((state) => {
			stateUpdates.push(state)
		})

		// Mock fetch to return a server
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		// Should have initial state emitted immediately
		expect(stateUpdates.length).toBe(1)

		// Start SSE - should emit state change (discovering: false → true)
		multiServerSSE.start()
		expect(stateUpdates.length).toBe(2)

		// Discovery should emit when server found
		await vi.advanceTimersByTimeAsync(100)
		expect(stateUpdates.length).toBeGreaterThan(2)

		unsubscribe()
	})

	it("onStateChange() returns unsubscribe function", () => {
		const callback = vi.fn()
		const unsubscribe = multiServerSSE.onStateChange(callback)

		expect(typeof unsubscribe).toBe("function")

		callback.mockClear()
		unsubscribe()

		// After unsubscribe, no more callbacks
		multiServerSSE.start()
		expect(callback).not.toHaveBeenCalled()
	})

	it("SSR safety: getCurrentState() structure is always valid", () => {
		// Test that getCurrentState() returns a valid structure
		// (hook relies on this for SSR initialization)
		const state = multiServerSSE.getCurrentState()

		expect(state).toHaveProperty("discovering")
		expect(state).toHaveProperty("connected")
		expect(state).toHaveProperty("servers")
		expect(state).toHaveProperty("connections")
		expect(typeof state.discovering).toBe("boolean")
		expect(typeof state.connected).toBe("boolean")
		expect(Array.isArray(state.servers)).toBe(true)
		expect(Array.isArray(state.connections)).toBe(true)
	})

	it("multiple subscribers receive same state updates", async () => {
		const updates1: unknown[] = []
		const updates2: unknown[] = []

		const unsub1 = multiServerSSE.onStateChange((state) => updates1.push(state))
		const unsub2 = multiServerSSE.onStateChange((state) => updates2.push(state))

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		multiServerSSE.start()
		await vi.advanceTimersByTimeAsync(100)

		// Both should receive same updates
		expect(updates1.length).toBeGreaterThan(0)
		expect(updates2.length).toBe(updates1.length)

		unsub1()
		unsub2()
	})
})
