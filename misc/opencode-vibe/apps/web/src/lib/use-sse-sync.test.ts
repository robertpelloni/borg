/**
 * Tests for useEffect stability with useOpencodeStore
 *
 * Verifies that effects using useOpencodeStore.getState() or .subscribe()
 * do NOT cause infinite loops.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useEffect, useState } from "react"
import { useOpencodeStore } from "@opencode-vibe/react/store"

describe("useEffect + useOpencodeStore stability", () => {
	beforeEach(() => {
		// Reset store before each test
		useOpencodeStore.setState({ directories: {} })
	})

	describe("getState() pattern", () => {
		it("should NOT cause infinite loop when using getState() in effect", () => {
			const effectSpy = vi.fn()
			const directory = "/test-dir"

			const { rerender } = renderHook(() => {
				useEffect(() => {
					effectSpy()
					// Correct pattern: use getState() for actions
					useOpencodeStore.getState().initDirectory(directory)
				}, [directory])
			})

			// Effect runs once on mount
			expect(effectSpy).toHaveBeenCalledTimes(1)

			// Re-render should NOT trigger effect again (directory unchanged)
			rerender()
			expect(effectSpy).toHaveBeenCalledTimes(1)

			// Store updates should NOT trigger effect
			useOpencodeStore.setState((state) => ({
				...state,
				directories: {
					...state.directories,
					[directory]: {
						...state.directories[directory],
						sessions: [],
					} as any,
				},
			}))
			rerender()
			expect(effectSpy).toHaveBeenCalledTimes(1)
		})

		it("should re-run effect only when dependencies change", () => {
			const effectSpy = vi.fn()
			let directory = "/test-dir-1"

			const { rerender } = renderHook(() => {
				useEffect(() => {
					effectSpy()
					useOpencodeStore.getState().initDirectory(directory)
				}, [directory])
			})

			expect(effectSpy).toHaveBeenCalledTimes(1)

			// Change dependency - effect should run again
			directory = "/test-dir-2"
			rerender()
			expect(effectSpy).toHaveBeenCalledTimes(2)
		})
	})

	describe("subscribe() pattern", () => {
		it("should NOT cause infinite loop when using subscribe() in effect", () => {
			const effectSpy = vi.fn()
			const subscriberSpy = vi.fn()
			const directory = "/test-dir"

			const { rerender } = renderHook(() => {
				const [, setCount] = useState(0)

				useEffect(() => {
					effectSpy()

					const unsubscribe = useOpencodeStore.subscribe((state) => {
						subscriberSpy()
						// Simulate reading state in subscriber
						const dirState = state.directories[directory]
						if (dirState) {
							// Do something with state
							void dirState.sessions
						}
					})

					return unsubscribe
				}, [directory])

				return { trigger: () => setCount((c) => c + 1) }
			})

			// Effect runs once on mount
			expect(effectSpy).toHaveBeenCalledTimes(1)
			// Subscriber not called yet (no state changes)
			expect(subscriberSpy).toHaveBeenCalledTimes(0)

			// Re-render component should NOT re-run effect
			rerender()
			expect(effectSpy).toHaveBeenCalledTimes(1)

			// Update store - subscriber should fire
			useOpencodeStore.getState().initDirectory(directory)
			expect(subscriberSpy).toHaveBeenCalledTimes(1)

			// Another store update
			useOpencodeStore.setState((state) => ({
				...state,
				directories: {
					...state.directories,
					[directory]: {
						...state.directories[directory],
						sessions: [{ id: "test-session" } as any],
					} as any,
				},
			}))
			expect(subscriberSpy).toHaveBeenCalledTimes(2)

			// Component re-render should NOT re-run effect or reset subscriber
			rerender()
			expect(effectSpy).toHaveBeenCalledTimes(1)
			expect(subscriberSpy).toHaveBeenCalledTimes(2)
		})

		it("should unsubscribe on unmount", () => {
			const subscriberSpy = vi.fn()
			const directory = "/test-dir"

			const { unmount } = renderHook(() => {
				useEffect(() => {
					const unsubscribe = useOpencodeStore.subscribe(() => {
						subscriberSpy()
					})
					return unsubscribe
				}, [directory])
			})

			// Initial subscriber call
			useOpencodeStore.getState().initDirectory(directory)
			expect(subscriberSpy).toHaveBeenCalledTimes(1)

			// Unmount - should unsubscribe
			unmount()

			// Store update after unmount - subscriber should NOT fire
			useOpencodeStore.setState((state) => ({
				...state,
				directories: {
					...state.directories,
					[directory]: {
						...state.directories[directory],
						sessions: [{ id: "test-session-2" } as any],
					} as any,
				},
			}))
			expect(subscriberSpy).toHaveBeenCalledTimes(1) // Still 1
		})
	})

	describe("anti-pattern documentation (characterization)", () => {
		it("documents why we use getState() instead of hook return value", () => {
			const effectSpy = vi.fn()
			const directory = "/test-dir"

			// This documents the pattern we AVOID and why
			// In practice, Zustand's useOpencodeStore() hook uses stable selector equality
			// so the reference doesn't change on every render. HOWEVER, this is an
			// implementation detail we don't rely on.
			const { rerender } = renderHook(() => {
				// ❌ Pattern to avoid: getting hook return value
				const store = useOpencodeStore()

				// ❌ Pattern to avoid: using store in dependency array
				useEffect(() => {
					effectSpy()
					store.initDirectory?.(directory)
				}, [directory, store])
			})

			// Effect runs on mount
			expect(effectSpy).toHaveBeenCalled()

			// Re-render - in current implementation, store reference is stable
			// so effect doesn't re-run. BUT we don't rely on this behavior.
			const initialCalls = effectSpy.mock.calls.length
			rerender()

			// Document current behavior: stable reference means no re-run
			expect(effectSpy.mock.calls.length).toBe(initialCalls)

			// WHY WE STILL USE getState():
			// 1. Implementation detail: Zustand could change selector behavior
			// 2. Explicit intent: getState() clearly shows "I'm reading state"
			// 3. Performance: Avoids subscription overhead for one-time actions
			// 4. Consistency: Same pattern works for all store methods
		})
	})

	describe("real-world pattern: session hydration (session-messages.tsx)", () => {
		it("should hydrate once on mount, not on every render", () => {
			const directory = "/test-dir"
			const sessionId = "session-123"
			const initialMessages = [{ id: "msg-1", role: "user" } as any]
			const initialParts = { "msg-1": [] }

			const hydrateSpy = vi.fn()
			useOpencodeStore.getState().hydrateMessages = hydrateSpy

			const { rerender } = renderHook(() => {
				useEffect(() => {
					if (!directory) return
					if (initialMessages.length === 0) return

					// Real pattern from session-messages.tsx
					useOpencodeStore
						.getState()
						.hydrateMessages(directory, sessionId, initialMessages, initialParts)
				}, [directory, sessionId, initialMessages, initialParts])
			})

			// Hydrates once on mount
			expect(hydrateSpy).toHaveBeenCalledTimes(1)
			expect(hydrateSpy).toHaveBeenCalledWith(directory, sessionId, initialMessages, initialParts)

			// Re-render with same props - should NOT hydrate again
			rerender()
			expect(hydrateSpy).toHaveBeenCalledTimes(1)

			// Store updates should NOT trigger hydration
			useOpencodeStore.setState((state) => ({
				...state,
				directories: {
					...state.directories,
					[directory]: {
						...state.directories[directory],
						messages: { [sessionId]: initialMessages },
					} as any,
				},
			}))
			rerender()
			expect(hydrateSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe("real-world pattern: multi-directory subscription", () => {
		it("should maintain stable subscription across re-renders", () => {
			const directories = ["/dir-1", "/dir-2"]
			const subscriberSpy = vi.fn()

			const { rerender } = renderHook(
				({ dirs }) => {
					useEffect(() => {
						const directorySet = new Set(dirs)

						const unsubscribe = useOpencodeStore.subscribe((state) => {
							subscriberSpy()
							for (const dir of directorySet) {
								void state.directories[dir]
							}
						})

						return unsubscribe
					}, [dirs])
				},
				{ initialProps: { dirs: directories } },
			)

			// No subscriber calls yet (no state changes)
			expect(subscriberSpy).toHaveBeenCalledTimes(0)

			// Update store - subscriber fires
			useOpencodeStore.getState().initDirectory("/dir-1")
			expect(subscriberSpy).toHaveBeenCalledTimes(1)

			// Re-render with SAME directories - subscription should persist
			rerender({ dirs: directories })
			expect(subscriberSpy).toHaveBeenCalledTimes(1) // Still 1

			// Another store update - same subscriber fires
			useOpencodeStore.getState().initDirectory("/dir-2")
			expect(subscriberSpy).toHaveBeenCalledTimes(2)

			// Re-render again
			rerender({ dirs: directories })
			expect(subscriberSpy).toHaveBeenCalledTimes(2) // Still 2
		})

		it("should re-subscribe when directories change", () => {
			const subscriberSpy = vi.fn()

			const { rerender } = renderHook(
				({ dirs }: { dirs: string[] }) => {
					useEffect(() => {
						const directorySet = new Set(dirs)

						const unsubscribe = useOpencodeStore.subscribe((state) => {
							subscriberSpy()
							for (const dir of directorySet) {
								void state.directories[dir]
							}
						})

						return unsubscribe
					}, [dirs])
				},
				{ initialProps: { dirs: ["/dir-1"] } },
			)

			// Initial subscription
			useOpencodeStore.getState().initDirectory("/dir-1")
			expect(subscriberSpy).toHaveBeenCalledTimes(1)

			// Change directories - should re-subscribe
			rerender({ dirs: ["/dir-1", "/dir-2"] })

			// Store update - new subscriber fires
			useOpencodeStore.getState().initDirectory("/dir-2")
			expect(subscriberSpy).toHaveBeenCalledTimes(2)
		})
	})
})
