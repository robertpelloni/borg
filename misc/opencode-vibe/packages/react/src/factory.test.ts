/**
 * Factory Tests - Provider-free hooks generation
 *
 * Tests the generateOpencodeHelpers factory function that creates hooks
 * which read config from globalThis.__OPENCODE (injected by SSR plugin).
 *
 * Pattern: Test pure logic without DOM rendering (TDD doctrine)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { getOpencodeConfig, generateOpencodeHelpers } from "./factory"
import type { OpencodeConfig } from "./next-ssr-plugin"
import type { Session, Message } from "./store/types"
import { useOpencodeStore } from "./store"

// Mock window for node environment
const mockWindow = {
	__OPENCODE: undefined as OpencodeConfig | undefined,
}

vi.stubGlobal("window", mockWindow)

describe("generateOpencodeHelpers", () => {
	beforeEach(() => {
		// Reset window.__OPENCODE between tests
		mockWindow.__OPENCODE = undefined
		// Reset store state to prevent leakage between tests
		useOpencodeStore.setState({ directories: {} })
	})

	describe("getOpencodeConfig", () => {
		it("reads from globalThis when available", () => {
			mockWindow.__OPENCODE = {
				baseUrl: "/api/opencode/4056",
				directory: "/path",
			}

			const config = getOpencodeConfig()

			expect(config.baseUrl).toBe("/api/opencode/4056")
			expect(config.directory).toBe("/path")
		})

		it("uses fallback config when globalThis empty", () => {
			const fallback: OpencodeConfig = {
				baseUrl: "/fallback",
				directory: "/fallback-path",
			}

			const config = getOpencodeConfig(fallback)

			expect(config.baseUrl).toBe("/fallback")
			expect(config.directory).toBe("/fallback-path")
		})

		it("prefers globalThis over fallback", () => {
			mockWindow.__OPENCODE = {
				baseUrl: "/global",
				directory: "/global-path",
			}

			const fallback: OpencodeConfig = {
				baseUrl: "/fallback",
				directory: "/fallback-path",
			}

			const config = getOpencodeConfig(fallback)

			expect(config.baseUrl).toBe("/global")
			expect(config.directory).toBe("/global-path")
		})

		it("throws when no config available", () => {
			expect(() => {
				getOpencodeConfig()
			}).toThrow(/No configuration found/)
		})

		it("throws with helpful error message mentioning SSR plugin", () => {
			expect(() => {
				getOpencodeConfig()
			}).toThrow(/Did you forget to add <OpencodeSSRPlugin>/)
		})

		it("rejects fallback without baseUrl", () => {
			const invalidFallback = {
				baseUrl: "",
				directory: "/path",
			}

			expect(() => {
				getOpencodeConfig(invalidFallback)
			}).toThrow(/No configuration found/)
		})

		it("returns fallback during SSR (typeof window === undefined)", () => {
			// Simulate SSR by temporarily removing window
			const originalWindow = global.window
			// @ts-expect-error - Simulating SSR environment
			delete global.window

			const fallback: OpencodeConfig = {
				baseUrl: "/ssr-fallback",
				directory: "/ssr-path",
			}

			const config = getOpencodeConfig(fallback)

			expect(config.baseUrl).toBe("/ssr-fallback")
			expect(config.directory).toBe("/ssr-path")

			// Restore window
			global.window = originalWindow
		})

		it("returns placeholder config during SSR without fallback", () => {
			// Simulate SSR by temporarily removing window
			const originalWindow = global.window
			// @ts-expect-error - Simulating SSR environment
			delete global.window

			const config = getOpencodeConfig()

			// Should return placeholder, not throw
			expect(config.baseUrl).toBe("")
			expect(config.directory).toBe("")

			// Restore window
			global.window = originalWindow
		})
	})

	describe("config serialization", () => {
		it("config is JSON-serializable", () => {
			const config: OpencodeConfig = {
				baseUrl: "/api",
				directory: "/path",
			}

			expect(() => JSON.stringify(config)).not.toThrow()
			const serialized = JSON.stringify(config)
			const deserialized = JSON.parse(serialized)

			expect(deserialized).toEqual(config)
		})
	})

	describe("type safety", () => {
		it("OpencodeConfig has required fields", () => {
			const config: OpencodeConfig = {
				baseUrl: "/api",
				directory: "/path",
			}

			expect(config).toHaveProperty("baseUrl")
			expect(config).toHaveProperty("directory")
		})
	})

	describe("generated hooks", () => {
		let helpers: ReturnType<typeof generateOpencodeHelpers>

		beforeEach(() => {
			// Set up config for hook generation
			mockWindow.__OPENCODE = {
				baseUrl: "/api/opencode/4056",
				directory: "/test/project",
			}

			// Generate hooks
			helpers = generateOpencodeHelpers()
		})

		describe("factory returns all 9 hooks", () => {
			it("returns useSession hook function", () => {
				expect(helpers.useSession).toBeDefined()
				expect(typeof helpers.useSession).toBe("function")
			})

			it("returns useMessages hook function", () => {
				expect(helpers.useMessages).toBeDefined()
				expect(typeof helpers.useMessages).toBe("function")
			})

			it("returns useSendMessage hook function", () => {
				expect(helpers.useSendMessage).toBeDefined()
				expect(typeof helpers.useSendMessage).toBe("function")
			})

			it("returns useSessionList hook function", () => {
				expect(helpers.useSessionList).toBeDefined()
				expect(typeof helpers.useSessionList).toBe("function")
			})

			it("returns useProviders hook function", () => {
				expect(helpers.useProviders).toBeDefined()
				expect(typeof helpers.useProviders).toBe("function")
			})

			it("returns useProjects hook function", () => {
				expect(helpers.useProjects).toBeDefined()
				expect(typeof helpers.useProjects).toBe("function")
			})

			it("returns useCommands hook function", () => {
				expect(helpers.useCommands).toBeDefined()
				expect(typeof helpers.useCommands).toBe("function")
			})

			it("returns useCreateSession hook function", () => {
				expect(helpers.useCreateSession).toBeDefined()
				expect(typeof helpers.useCreateSession).toBe("function")
			})

			it("returns useFileSearch hook function", () => {
				expect(helpers.useFileSearch).toBeDefined()
				expect(typeof helpers.useFileSearch).toBe("function")
			})
		})

		describe("config integration", () => {
			it("hooks share same config from globalThis", () => {
				const config = getOpencodeConfig()
				expect(config.baseUrl).toBe("/api/opencode/4056")
				expect(config.directory).toBe("/test/project")
			})

			it("factory works without explicit config parameter", () => {
				// All hooks use getOpencodeConfig() internally
				expect(helpers).toHaveProperty("useSession")
				expect(helpers).toHaveProperty("useMessages")
				expect(helpers).toHaveProperty("useSendMessage")
				expect(helpers).toHaveProperty("useSessionList")
				expect(helpers).toHaveProperty("useProviders")
				expect(helpers).toHaveProperty("useProjects")
				expect(helpers).toHaveProperty("useCommands")
				expect(helpers).toHaveProperty("useCreateSession")
				expect(helpers).toHaveProperty("useFileSearch")
			})

			it("factory can be called with explicit config override", () => {
				const customConfig: OpencodeConfig = {
					baseUrl: "/custom",
					directory: "/custom/path",
				}

				const customHelpers = generateOpencodeHelpers(customConfig)
				expect(customHelpers.useSession).toBeDefined()
			})
		})

		describe("hook name consistency", () => {
			it("hook names match expected pattern", () => {
				const hookNames = Object.keys(helpers)
				expect(hookNames).toContain("useSession")
				expect(hookNames).toContain("useMessages")
				expect(hookNames).toContain("useSendMessage")
				expect(hookNames).toContain("useSessionList")
				expect(hookNames).toContain("useProviders")
				expect(hookNames).toContain("useProjects")
				expect(hookNames).toContain("useCommands")
				expect(hookNames).toContain("useCreateSession")
				expect(hookNames).toContain("useFileSearch")
			})

			it("generates exactly 23 hooks", () => {
				const hookCount = Object.keys(helpers).length
				expect(hookCount).toBe(23)
			})
		})
	})

	describe("useSSEEvents cross-directory behavior", () => {
		it("store can handle SSE events for all directories (verifies capability exists)", () => {
			// This test verifies that the STORE can handle cross-directory events.
			// The bug was in useSSEEvents (line ~935) filtering out cross-directory events
			// BEFORE they reach the store.
			//
			// This test proves the store's handleSSEEvent auto-initializes directories
			// and processes events correctly. The fix is to remove the filter in
			// useSSEEvents so events reach the store.
			//
			// Testing the actual hook behavior requires React rendering, which we avoid
			// per TDD doctrine (no DOM testing). This test validates the underlying
			// capability - the store CAN handle cross-directory events.

			// Setup: Configure for directory A
			mockWindow.__OPENCODE = {
				baseUrl: "/api/opencode/4056",
				directory: "/project-a",
			}

			// Simulate SSE event for directory B (different from configured directory)
			// Status is pre-normalized by Core's normalizeStatus() in multi-server-sse.ts
			const directoryBEvent = {
				directory: "/project-b",
				payload: {
					type: "session.status",
					properties: {
						sessionID: "test-session-123",
						status: "running", // Pre-normalized by Core
					},
				},
			}

			// Before fix: this would be filtered out at line 935
			// After fix: store should handle it via auto-init
			useOpencodeStore.getState().handleSSEEvent(directoryBEvent)

			// Verify store created directory B state and processed the event
			const state = useOpencodeStore.getState()
			expect(state.directories["/project-b"]).toBeDefined()
			expect(state.directories["/project-b"]?.sessionStatus["test-session-123"]).toBe("running")
		})

		it("still processes events for the configured directory", () => {
			// Sanity check: removing the filter shouldn't break same-directory events

			mockWindow.__OPENCODE = {
				baseUrl: "/api/opencode/4056",
				directory: "/project-a",
			}

			// Status is pre-normalized by Core's normalizeStatus() in multi-server-sse.ts
			const sameDirectoryEvent = {
				directory: "/project-a",
				payload: {
					type: "session.status",
					properties: {
						sessionID: "test-session-456",
						status: "completed", // Pre-normalized by Core
					},
				},
			}

			useOpencodeStore.getState().handleSSEEvent(sameDirectoryEvent)

			const state = useOpencodeStore.getState()
			expect(state.directories["/project-a"]).toBeDefined()
			expect(state.directories["/project-a"]?.sessionStatus["test-session-456"]).toBe("completed")
		})
	})
})
