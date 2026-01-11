/**
 * Tests for sessions atom Effect programs
 *
 * Tests verify:
 * - Session list fetching via Effect.runPromise
 * - Error handling with Effect error channel
 * - Sorting by updated time descending
 */

import { describe, expect, it, vi, beforeEach } from "vitest"
import { Effect } from "effect"
import { SessionAtom } from "./sessions.js"
import type { Session } from "../types/index.js"

/**
 * Mock session factory
 */
function createMockSession(overrides?: Partial<Session>): Session {
	return {
		id: "ses_123",
		title: "Test Session",
		directory: "/test/project",
		time: {
			created: Date.now(),
			updated: Date.now(),
		},
		...overrides,
	}
}

/**
 * Mock createClient for testing
 * This is a simplified mock - in real usage, we'd use dependency injection
 */
vi.mock("../client/index.js", () => ({
	createClient: vi.fn((directory?: string) => ({
		session: {
			list: vi.fn(() =>
				Promise.resolve({
					data: [
						createMockSession({ id: "ses_1", title: "Session 1" }),
						createMockSession({ id: "ses_2", title: "Session 2" }),
					],
				}),
			),
			get: vi.fn(({ path }: { path: { id: string } }) =>
				Promise.resolve({
					data: createMockSession({ id: path.id, title: `Session ${path.id}` }),
				}),
			),
		},
	})),
}))

describe("SessionAtom.list Effect program", () => {
	it("fetches session list successfully", async () => {
		const sessions = await Effect.runPromise(SessionAtom.list("/test/project"))

		expect(sessions).toHaveLength(2)
		expect(sessions[0]?.id).toBe("ses_1")
		expect(sessions[1]?.id).toBe("ses_2")
	})

	it("sorts sessions by updated time descending (newest first)", async () => {
		// Re-mock createClient with specific timestamps
		const now = Date.now()
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				list: vi.fn(() =>
					Promise.resolve({
						data: [
							createMockSession({
								id: "ses_1",
								time: { created: now, updated: now - 3000 },
							}),
							createMockSession({
								id: "ses_2",
								time: { created: now, updated: now - 1000 },
							}),
							createMockSession({
								id: "ses_3",
								time: { created: now, updated: now - 2000 },
							}),
						],
					}),
				),
			},
		} as any)

		const sessions = await Effect.runPromise(SessionAtom.list())

		// Should be sorted newest first
		expect(sessions[0]?.id).toBe("ses_2") // Most recent (now - 1000)
		expect(sessions[1]?.id).toBe("ses_3") // Middle (now - 2000)
		expect(sessions[2]?.id).toBe("ses_1") // Oldest (now - 3000)
	})

	it("handles empty session list", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				list: vi.fn(() => Promise.resolve({ data: [] })),
			},
		} as any)

		const sessions = await Effect.runPromise(SessionAtom.list())

		expect(sessions).toHaveLength(0)
	})

	it("handles null/undefined data gracefully", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				list: vi.fn(() => Promise.resolve({ data: null })),
			},
		} as any)

		const sessions = await Effect.runPromise(SessionAtom.list())

		expect(sessions).toHaveLength(0)
	})

	it("propagates errors through Effect error channel", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				list: vi.fn(() => Promise.reject(new Error("Network error"))),
			},
		} as any)

		// Effect.runPromise throws on error
		await expect(Effect.runPromise(SessionAtom.list())).rejects.toThrow("Failed to fetch sessions")
	})
})

describe("SessionAtom.get Effect program", () => {
	it("fetches single session by ID", async () => {
		const session = await Effect.runPromise(SessionAtom.get("ses_123"))

		expect(session).not.toBeNull()
		expect(session?.id).toBe("ses_123")
		expect(session?.title).toBe("Session ses_123")
	})

	it("returns null when session not found", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				get: vi.fn(() => Promise.resolve({ data: null })),
			},
		} as any)

		const session = await Effect.runPromise(SessionAtom.get("nonexistent"))

		expect(session).toBeNull()
	})

	it("propagates errors through Effect error channel", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				get: vi.fn(() => Promise.reject(new Error("Network error"))),
			},
		} as any)

		await expect(Effect.runPromise(SessionAtom.get("ses_123"))).rejects.toThrow(
			"Failed to fetch session",
		)
	})
})

describe("SessionAtom session-based routing", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("passes sessionId to createClient for get()", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				get: vi.fn(() =>
					Promise.resolve({
						data: createMockSession({ id: "ses_456" }),
					}),
				),
			},
		} as any)

		await Effect.runPromise(SessionAtom.get("ses_456", "/test/project"))

		// Verify createClient was called with both directory AND sessionId
		expect(createClient).toHaveBeenCalledWith("/test/project", "ses_456")
	})

	it("passes sessionId to createClient for promptAsync()", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				promptAsync: vi.fn(() => Promise.resolve({})),
			},
		} as any)

		await Effect.runPromise(
			SessionAtom.promptAsync(
				"ses_789",
				[{ type: "text", content: "Hello" }],
				undefined,
				"/test/project",
			),
		)

		// Verify createClient was called with both directory AND sessionId
		expect(createClient).toHaveBeenCalledWith("/test/project", "ses_789")
	})

	it("passes sessionId to createClient for command()", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				command: vi.fn(() => Promise.resolve({})),
			},
		} as any)

		await Effect.runPromise(SessionAtom.command("ses_abc", "test", "args", "/test/project"))

		// Verify createClient was called with both directory AND sessionId
		expect(createClient).toHaveBeenCalledWith("/test/project", "ses_abc")
	})

	it("list() does NOT pass sessionId (no session context yet)", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				list: vi.fn(() => Promise.resolve({ data: [] })),
			},
		} as any)

		await Effect.runPromise(SessionAtom.list("/test/project"))

		// list() should only pass directory, not sessionId
		expect(createClient).toHaveBeenCalledWith("/test/project")
	})
})

describe("SessionAtom composability", () => {
	it("can be composed with other Effect programs", async () => {
		const program = Effect.gen(function* () {
			const sessions = yield* SessionAtom.list("/test/project")
			// Filter sessions with "Session 1" in title
			return sessions.filter((s) => s.title.includes("Session 1"))
		})

		const filtered = await Effect.runPromise(program)

		expect(filtered).toHaveLength(1)
		expect(filtered[0]?.title).toBe("Session 1")
	})

	it("supports Effect error handling combinators", async () => {
		const { createClient } = await import("../client/index.js")

		vi.mocked(createClient).mockReturnValueOnce({
			session: {
				list: vi.fn(() => Promise.reject(new Error("Network error"))),
			},
		} as any)

		// Use Effect.catchAll to provide fallback
		const program = SessionAtom.list().pipe(Effect.catchAll(() => Effect.succeed([] as Session[])))

		const sessions = await Effect.runPromise(program)

		expect(sessions).toHaveLength(0)
	})
})
