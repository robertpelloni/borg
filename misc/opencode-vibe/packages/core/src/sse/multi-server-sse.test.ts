import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
	MultiServerSSE,
	HEALTH_TIMEOUT_MS,
	BASE_BACKOFF_MS,
	MAX_BACKOFF_MS,
	calculateBackoff,
} from "./multi-server-sse.js"

/**
 * Backoff calculation tests - pure function, no mocking needed
 */
describe("calculateBackoff", () => {
	it("should use base delay for first attempt", () => {
		// With jitter, should be between BASE and BASE * 1.2
		const delay = calculateBackoff(0)
		expect(delay).toBeGreaterThanOrEqual(BASE_BACKOFF_MS)
		expect(delay).toBeLessThanOrEqual(BASE_BACKOFF_MS * 1.2)
	})

	it("should double delay on each attempt (before jitter)", () => {
		// Test the base delays without jitter by checking ranges
		// attempt 1: 2s base → 2-2.4s with jitter
		const delay1 = calculateBackoff(1)
		expect(delay1).toBeGreaterThanOrEqual(2000)
		expect(delay1).toBeLessThanOrEqual(2400)

		// attempt 2: 4s base → 4-4.8s with jitter
		const delay2 = calculateBackoff(2)
		expect(delay2).toBeGreaterThanOrEqual(4000)
		expect(delay2).toBeLessThanOrEqual(4800)

		// attempt 3: 8s base → 8-9.6s with jitter
		const delay3 = calculateBackoff(3)
		expect(delay3).toBeGreaterThanOrEqual(8000)
		expect(delay3).toBeLessThanOrEqual(9600)
	})

	it("should cap at max delay", () => {
		// attempt 5: 32s capped to 30s → 30-36s with jitter
		const delay5 = calculateBackoff(5)
		expect(delay5).toBeGreaterThanOrEqual(MAX_BACKOFF_MS)
		expect(delay5).toBeLessThanOrEqual(MAX_BACKOFF_MS * 1.2)

		// attempt 10: still capped
		const delay10 = calculateBackoff(10)
		expect(delay10).toBeGreaterThanOrEqual(MAX_BACKOFF_MS)
		expect(delay10).toBeLessThanOrEqual(MAX_BACKOFF_MS * 1.2)
	})

	it("should add jitter (not deterministic)", () => {
		// Call multiple times - should get different values
		const delays = new Set<number>()
		for (let i = 0; i < 10; i++) {
			delays.add(calculateBackoff(2))
		}
		// With jitter, we should get at least a few different values
		expect(delays.size).toBeGreaterThan(1)
	})
})

/**
 * Connection state tracking tests
 */
describe("MultiServerSSE connection status", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("should start with no connections", () => {
		const sse = new MultiServerSSE()
		expect(sse.isConnected()).toBe(false)
		expect(sse.getConnectionStatus().size).toBe(0)
	})

	it("should track connection status after discovery", async () => {
		const sse = new MultiServerSSE()

		// Mock fetch to return a server
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			// SSE connection - return a readable stream that stays open
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()

		// Wait for discovery
		await vi.advanceTimersByTimeAsync(100)

		// Should have a connecting/connected state for port 3000
		const status = sse.getConnectionStatus()
		expect(status.has(3000)).toBe(true)

		sse.stop()
	})
})

/**
 * Observable state tests - onStateChange callback system
 */
describe("MultiServerSSE observable state", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("should call onStateChange callback immediately with current state", () => {
		const sse = new MultiServerSSE()
		const callback = vi.fn()

		sse.onStateChange(callback)

		expect(callback).toHaveBeenCalledTimes(1)
		expect(callback).toHaveBeenCalledWith({
			servers: [],
			connections: [],
			discovering: false,
			connected: false,
		})
	})

	it("should return unsubscribe function", () => {
		const sse = new MultiServerSSE()
		const callback = vi.fn()

		const unsubscribe = sse.onStateChange(callback)

		expect(typeof unsubscribe).toBe("function")
		callback.mockClear()

		// Unsubscribe
		unsubscribe()

		// Trigger a state change (via start)
		sse.start()

		// Callback should not be called after unsubscribe
		expect(callback).not.toHaveBeenCalled()

		sse.stop()
	})

	it("should emit state change on server discovery", async () => {
		const sse = new MultiServerSSE()
		const callback = vi.fn()

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onStateChange(callback)
		callback.mockClear() // Clear initial call

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Should have emitted state change with discovered server
		expect(callback).toHaveBeenCalled()
		const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
		expect(lastCall.servers.length).toBeGreaterThan(0)
		expect(lastCall.servers[0].port).toBe(3000)

		sse.stop()
	})

	it("should emit state change on connection state changes", async () => {
		const sse = new MultiServerSSE()
		const callback = vi.fn()

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onStateChange(callback)
		callback.mockClear()

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Should emit for connecting → connected transitions
		const calls = callback.mock.calls
		expect(calls.length).toBeGreaterThan(0)

		// At least one call should show connection state
		const hasConnectionState = calls.some((call) => {
			const state = call[0]
			return state.connections.length > 0
		})
		expect(hasConnectionState).toBe(true)

		sse.stop()
	})

	it("should handle multiple subscribers", async () => {
		const sse = new MultiServerSSE()
		const callback1 = vi.fn()
		const callback2 = vi.fn()

		sse.onStateChange(callback1)
		sse.onStateChange(callback2)

		// Both should get initial state
		expect(callback1).toHaveBeenCalledTimes(1)
		expect(callback2).toHaveBeenCalledTimes(1)

		callback1.mockClear()
		callback2.mockClear()

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Both should receive state changes
		expect(callback1).toHaveBeenCalled()
		expect(callback2).toHaveBeenCalled()

		sse.stop()
	})

	it("should not call callbacks after they are unsubscribed", () => {
		const sse = new MultiServerSSE()
		const callback1 = vi.fn()
		const callback2 = vi.fn()

		const unsub1 = sse.onStateChange(callback1)
		sse.onStateChange(callback2)

		callback1.mockClear()
		callback2.mockClear()

		// Unsubscribe first callback
		unsub1()

		// Trigger state change
		sse.start()

		// Only callback2 should be called
		expect(callback1).not.toHaveBeenCalled()
		expect(callback2).toHaveBeenCalled()

		sse.stop()
	})

	it("getCurrentState should return current SSEState", () => {
		const sse = new MultiServerSSE()

		const state = sse.getCurrentState()

		expect(state).toHaveProperty("servers")
		expect(state).toHaveProperty("connections")
		expect(state).toHaveProperty("discovering")
		expect(state).toHaveProperty("connected")
		expect(Array.isArray(state.servers)).toBe(true)
		expect(Array.isArray(state.connections)).toBe(true)
		expect(typeof state.discovering).toBe("boolean")
		expect(typeof state.connected).toBe("boolean")
	})

	it("should emit state change when server is removed", async () => {
		const sse = new MultiServerSSE()
		const callback = vi.fn()

		let returnServer = true

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				if (returnServer) {
					return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
				}
				return new Response(JSON.stringify([]))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onStateChange(callback)
		callback.mockClear()

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		const initialCalls = callback.mock.calls.length
		callback.mockClear()

		// Server disappears on next discovery
		returnServer = false
		await vi.advanceTimersByTimeAsync(5000) // Discovery interval

		// Should have emitted state change
		expect(callback).toHaveBeenCalled()

		sse.stop()
	})
})

/**
 * Health monitoring tests
 */
describe("MultiServerSSE health monitoring", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("should track last event time per connection", async () => {
		const sse = new MultiServerSSE()

		// Create a mock stream that sends events
		const mockStream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					new TextEncoder().encode(
						`data: ${JSON.stringify({ directory: "/test", payload: { type: "heartbeat", properties: {} } })}\n\n`,
					),
				)
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Get connection health - should have recent activity after connect
		const health = sse.getConnectionHealth()
		expect(health.has(3000)).toBe(true)

		const lastEventTime = health.get(3000)
		expect(lastEventTime).toBeDefined()
		expect(Date.now() - lastEventTime!).toBeLessThan(1000)

		sse.stop()
	})

	it("should have HEALTH_TIMEOUT constant of 60 seconds", () => {
		expect(HEALTH_TIMEOUT_MS).toBe(60000)
	})
})

/**
 * API routing tests - ensure correct /api/opencode prefix for REST calls
 */
describe("MultiServerSSE API routing", () => {
	it("should return /api/opencode prefix for session-based routing", () => {
		const sse = new MultiServerSSE()

		// Simulate discovery finding a server
		const servers = [{ port: 53306, pid: 123, directory: "/test/project" }]
		;(sse as any).directoryToPorts.set("/test/project", [53306])

		// Simulate session ownership tracking
		;(sse as any).sessionToPort.set("ses_123", 53306)

		const url = sse.getBaseUrlForSession("ses_123", "/test/project")

		// Should use /api/opencode for REST API calls, not /api/sse
		expect(url).toBe("/api/opencode/53306")
	})

	it("should return /api/opencode prefix for directory-based routing", () => {
		const sse = new MultiServerSSE()

		// Simulate discovery finding a server
		;(sse as any).directoryToPorts.set("/test/project", [53306])

		const url = sse.getBaseUrlForDirectory("/test/project")

		// Should use /api/opencode for REST API calls, not /api/sse
		expect(url).toBe("/api/opencode/53306")
	})

	it("should return undefined when no server found for directory", () => {
		const sse = new MultiServerSSE()

		const url = sse.getBaseUrlForDirectory("/unknown/project")

		expect(url).toBeUndefined()
	})

	it("should fallback to directory routing when session not in cache", () => {
		const sse = new MultiServerSSE()

		// Directory has a server, but session not tracked yet
		;(sse as any).directoryToPorts.set("/test/project", [53306])

		const url = sse.getBaseUrlForSession("ses_unknown", "/test/project")

		// Should fallback to directory's server
		expect(url).toBe("/api/opencode/53306")
	})

	it("should return undefined when session and directory both unknown", () => {
		const sse = new MultiServerSSE()

		const url = sse.getBaseUrlForSession("ses_unknown", "/unknown/project")

		expect(url).toBeUndefined()
	})
})

/**
 * Session cache pre-population tests
 */
describe("MultiServerSSE session cache pre-population", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("should pre-populate sessionToPort cache from discovery response", async () => {
		const sse = new MultiServerSSE()

		// Mock discovery response with sessions field
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(
					JSON.stringify([
						{
							port: 3000,
							pid: 123,
							directory: "/test",
							sessions: ["ses_abc", "ses_def"],
						},
						{
							port: 3001,
							pid: 124,
							directory: "/other",
							sessions: ["ses_xyz"],
						},
					]),
				)
			}
			// SSE connection
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify sessionToPort cache was populated
		expect(sse.getPortForSession("ses_abc")).toBe(3000)
		expect(sse.getPortForSession("ses_def")).toBe(3000)
		expect(sse.getPortForSession("ses_xyz")).toBe(3001)

		// Verify routing works
		expect(sse.getBaseUrlForSession("ses_abc", "/test")).toBe("/api/opencode/3000")
		expect(sse.getBaseUrlForSession("ses_xyz", "/other")).toBe("/api/opencode/3001")

		sse.stop()
	})

	it("should handle discovery response without sessions field", async () => {
		const sse = new MultiServerSSE()

		// Mock discovery response without sessions (backward compatibility)
		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(
					JSON.stringify([
						{
							port: 3000,
							pid: 123,
							directory: "/test",
							// No sessions field
						},
					]),
				)
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Should not crash, cache should be empty
		expect(sse.getPortForSession("ses_unknown")).toBeUndefined()

		// Should still fallback to directory routing
		expect(sse.getBaseUrlForSession("ses_unknown", "/test")).toBe("/api/opencode/3000")

		sse.stop()
	})

	it("should clean up cache entries for dead servers", async () => {
		const sse = new MultiServerSSE()

		// First discovery: two servers
		let discoveryResponse = [
			{ port: 3000, pid: 123, directory: "/test", sessions: ["ses_abc"] },
			{ port: 3001, pid: 124, directory: "/other", sessions: ["ses_xyz"] },
		]

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify(discoveryResponse))
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify both sessions are cached
		expect(sse.getPortForSession("ses_abc")).toBe(3000)
		expect(sse.getPortForSession("ses_xyz")).toBe(3001)

		// Second discovery: port 3001 is dead
		discoveryResponse = [{ port: 3000, pid: 123, directory: "/test", sessions: ["ses_abc"] }]

		// Trigger next discovery interval (5s default)
		await vi.advanceTimersByTimeAsync(5000)

		// ses_abc should still be cached (server alive)
		expect(sse.getPortForSession("ses_abc")).toBe(3000)

		// ses_xyz should be cleaned up (server dead)
		expect(sse.getPortForSession("ses_xyz")).toBeUndefined()

		sse.stop()
	})
})

/**
 * Exponential backoff behavior tests
 */
describe("MultiServerSSE reconnection behavior", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("should reset backoff on successful connection", async () => {
		const sse = new MultiServerSSE()
		let connectionAttempts = 0

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			connectionAttempts++
			// First 2 attempts fail, third succeeds
			if (connectionAttempts <= 2) {
				throw new Error("Connection failed")
			}
			return new Response(new ReadableStream(), {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()

		// First attempt fails immediately
		await vi.advanceTimersByTimeAsync(100)
		expect(connectionAttempts).toBe(1)

		// Wait for first backoff (1s + jitter, max ~1.2s)
		await vi.advanceTimersByTimeAsync(1500)
		expect(connectionAttempts).toBe(2)

		// Wait for second backoff (2s + jitter, max ~2.4s)
		await vi.advanceTimersByTimeAsync(3000)
		expect(connectionAttempts).toBeGreaterThanOrEqual(3)

		sse.stop()
	})
})

/**
 * Session event handling tests - verify session.created/updated/status events
 * are properly logged and emitted with correct directory path
 */
describe("MultiServerSSE session event handling", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	it("should emit session.created events with directory path", async () => {
		const sse = new MultiServerSSE()
		const eventCallback = vi.fn()

		// Create a mock stream that sends a session.created event
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "/test/project",
					payload: {
						type: "session.created",
						properties: {
							sessionID: "ses_new123",
							session: { id: "ses_new123", directory: "/test/project" },
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onEvent(eventCallback)
		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify session.created event was emitted with correct directory
		expect(eventCallback).toHaveBeenCalledWith(
			expect.objectContaining({
				directory: "/test/project",
				payload: expect.objectContaining({
					type: "session.created",
					properties: expect.objectContaining({
						sessionID: "ses_new123",
					}),
				}),
			}),
		)

		sse.stop()
	})

	it("should emit session.updated events with directory path", async () => {
		const sse = new MultiServerSSE()
		const eventCallback = vi.fn()

		// Create a mock stream that sends a session.updated event
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "/test/project",
					payload: {
						type: "session.updated",
						properties: {
							sessionID: "ses_existing",
							session: { id: "ses_existing", directory: "/test/project", title: "Updated Title" },
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onEvent(eventCallback)
		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify session.updated event was emitted with correct directory
		expect(eventCallback).toHaveBeenCalledWith(
			expect.objectContaining({
				directory: "/test/project",
				payload: expect.objectContaining({
					type: "session.updated",
					properties: expect.objectContaining({
						sessionID: "ses_existing",
					}),
				}),
			}),
		)

		sse.stop()
	})

	it("should emit session.status events with directory path", async () => {
		const sse = new MultiServerSSE()
		const eventCallback = vi.fn()
		const statusCallback = vi.fn()

		// Create a mock stream that sends a session.status event
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "/test/project",
					payload: {
						type: "session.status",
						properties: {
							sessionID: "ses_123",
							status: { type: "running" },
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onEvent(eventCallback)
		sse.onStatus(statusCallback)
		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify session.status event was emitted to both callbacks
		expect(eventCallback).toHaveBeenCalledWith(
			expect.objectContaining({
				directory: "/test/project",
				payload: expect.objectContaining({
					type: "session.status",
					properties: expect.objectContaining({
						sessionID: "ses_123",
						status: { type: "running" },
					}),
				}),
			}),
		)

		expect(statusCallback).toHaveBeenCalledWith(
			expect.objectContaining({
				directory: "/test/project",
				sessionID: "ses_123",
				status: "running", // Normalized from { type: "running" }
			}),
		)

		sse.stop()
	})

	it("should normalize status formats from session.status events", async () => {
		const sse = new MultiServerSSE()
		const statusCallback = vi.fn()

		// Test multiple status formats
		const testCases = [
			{ input: { type: "running" }, expected: "running" },
			{ input: { type: "idle" }, expected: "completed" },
			{ input: { type: "busy" }, expected: "running" },
			{ input: "pending", expected: "running" },
			{ input: "active", expected: "running" },
			{ input: "done", expected: "completed" },
			{ input: "completed", expected: "completed" },
			{ input: true, expected: "running" },
			{ input: false, expected: "completed" },
		]

		for (const { input, expected } of testCases) {
			statusCallback.mockClear()

			const mockStream = new ReadableStream({
				start(controller) {
					const event = {
						directory: "/test/project",
						payload: {
							type: "session.status",
							properties: {
								sessionID: "ses_test",
								status: input,
							},
						},
					}
					controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
				},
			})

			vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
				if (url === "/api/opencode/servers") {
					return new Response(
						JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]),
					)
				}
				return new Response(mockStream, {
					headers: { "Content-Type": "text/event-stream" },
				})
			})

			sse.onStatus(statusCallback)
			sse.start()
			await vi.advanceTimersByTimeAsync(100)

			expect(statusCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					directory: "/test/project",
					sessionID: "ses_test",
					status: expected,
				}),
			)

			sse.stop()
		}
	})

	it("should track sessionToPort mapping from session.created events", async () => {
		const sse = new MultiServerSSE()

		// Create a mock stream that sends a session.created event
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "/test/project",
					payload: {
						type: "session.created",
						properties: {
							sessionID: "ses_dynamic",
							session: { id: "ses_dynamic" },
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify sessionToPort mapping was updated
		expect(sse.getPortForSession("ses_dynamic")).toBe(3000)
		expect(sse.getBaseUrlForSession("ses_dynamic", "/test/project")).toBe("/api/opencode/3000")

		sse.stop()
	})

	it("should track sessionToPort mapping from session.updated events", async () => {
		const sse = new MultiServerSSE()

		// Create a mock stream that sends a session.updated event
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "/test/project",
					payload: {
						type: "session.updated",
						properties: {
							sessionID: "ses_updated",
							session: { id: "ses_updated" },
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify sessionToPort mapping was updated
		expect(sse.getPortForSession("ses_updated")).toBe(3000)
		expect(sse.getBaseUrlForSession("ses_updated", "/test/project")).toBe("/api/opencode/3000")

		sse.stop()
	})

	it("should handle nested sessionID in properties.session.id", async () => {
		const sse = new MultiServerSSE()

		// Create a mock stream with sessionID nested in properties.session
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "/test/project",
					payload: {
						type: "session.created",
						properties: {
							session: { id: "ses_nested" },
							// Note: No top-level sessionID
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test/project" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify it didn't crash and mapping still works if sessionID was extracted
		// The current implementation checks props.info.sessionID and props.part.sessionID
		// but NOT props.session.id - this test documents that gap
		expect(sse.getPortForSession("ses_nested")).toBeUndefined()

		sse.stop()
	})

	it("should not emit events for global directory", async () => {
		const sse = new MultiServerSSE()
		const eventCallback = vi.fn()

		// Create a mock stream that sends a global event (should be filtered)
		const mockStream = new ReadableStream({
			start(controller) {
				const event = {
					directory: "global",
					payload: {
						type: "session.created",
						properties: {
							sessionID: "ses_global",
						},
					},
				}
				controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
			},
		})

		vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
			if (url === "/api/opencode/servers") {
				return new Response(JSON.stringify([{ port: 3000, pid: 123, directory: "/test" }]))
			}
			return new Response(mockStream, {
				headers: { "Content-Type": "text/event-stream" },
			})
		})

		sse.onEvent(eventCallback)
		sse.start()
		await vi.advanceTimersByTimeAsync(100)

		// Verify global events are filtered out
		expect(eventCallback).not.toHaveBeenCalled()

		sse.stop()
	})
})
