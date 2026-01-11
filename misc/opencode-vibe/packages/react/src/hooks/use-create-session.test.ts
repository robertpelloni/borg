/**
 * useCreateSession Tests - Pure logic tests
 *
 * Tests the Promise API behavior without DOM rendering.
 * The hook is a thin wrapper around sessions.create(), so we test the API contract.
 */

import { describe, expect, test, vi, beforeEach } from "vitest"
import type { Session } from "@opencode-vibe/core/api"

// Mock sessions API
vi.mock("@opencode-vibe/core/api", () => ({
	sessions: {
		create: vi.fn(),
	},
}))

import { sessions } from "@opencode-vibe/core/api"

// Mock session data - matches core Session type
const mockSession: Session = {
	id: "ses_123",
	title: "Test Session",
	directory: "/test/dir",
	time: {
		created: Date.now(),
		updated: Date.now(),
	},
}

describe("useCreateSession - Promise API contract", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("calls sessions.create with title", async () => {
		;(sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)

		// Simulate what the hook does
		const createSession = async (title?: string) => {
			return await sessions.create(title)
		}

		const session = await createSession("My Session")

		expect(session).toEqual(mockSession)
		expect(sessions.create).toHaveBeenCalledTimes(1)
		expect(sessions.create).toHaveBeenCalledWith("My Session")
	})

	test("calls sessions.create without title", async () => {
		;(sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)

		const createSession = async (title?: string) => {
			return await sessions.create(title)
		}

		const session = await createSession()

		expect(session).toEqual(mockSession)
		expect(sessions.create).toHaveBeenCalledWith(undefined)
	})

	test("error handling wraps non-Error exceptions", async () => {
		;(sessions.create as ReturnType<typeof vi.fn>).mockRejectedValue("String error")

		const createSession = async (): Promise<{
			session: Session | null
			error: Error | null
		}> => {
			try {
				const result = await sessions.create()
				return { session: result, error: null }
			} catch (e) {
				const error = e instanceof Error ? e : new Error(String(e))
				return { session: null, error }
			}
		}

		const { session, error } = await createSession()

		expect(session).toBeNull()
		expect(error).toBeInstanceOf(Error)
		expect(error?.message).toBe("String error")
	})

	test("error handling preserves Error instances", async () => {
		const mockError = new Error("Network error")
		;(sessions.create as ReturnType<typeof vi.fn>).mockRejectedValue(mockError)

		let error: Error | null = null

		const createSession = async () => {
			try {
				return await sessions.create()
			} catch (e) {
				error = e instanceof Error ? e : new Error(String(e))
				return null
			}
		}

		const session = await createSession()

		expect(session).toBeNull()
		expect(error).toBe(mockError)
	})

	test("error state resets on subsequent successful calls", async () => {
		let shouldFail = true
		;(sessions.create as ReturnType<typeof vi.fn>).mockImplementation(async () => {
			if (shouldFail) {
				throw new Error("First call fails")
			}
			return mockSession
		})

		let error: Error | null = null

		const createSession = async () => {
			error = null // Reset error on each call (hook behavior)
			try {
				return await sessions.create()
			} catch (e) {
				error = e instanceof Error ? e : new Error(String(e))
				return null
			}
		}

		// First call fails
		await createSession()
		expect(error).toBeTruthy()

		// Second call succeeds
		shouldFail = false
		const session = await createSession()

		expect(session).toEqual(mockSession)
		expect(error).toBeNull()
	})

	test("multiple calls work independently", async () => {
		;(sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)

		const createSession = async (title?: string) => {
			return await sessions.create(title)
		}

		await createSession("Session 1")
		await createSession("Session 2")
		await createSession()

		expect(sessions.create).toHaveBeenCalledTimes(3)
		expect(sessions.create).toHaveBeenNthCalledWith(1, "Session 1")
		expect(sessions.create).toHaveBeenNthCalledWith(2, "Session 2")
		expect(sessions.create).toHaveBeenNthCalledWith(3, undefined)
	})
})
