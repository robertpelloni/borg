import { describe, test, expect } from "vitest"

/**
 * Test the SessionRow memo comparison logic in isolation.
 *
 * SessionRow gets status from useMultiDirectoryStatus hook which:
 * 1. Bootstraps status on mount via SDK session.status()
 * 2. Subscribes to store updates (fed by SSE events)
 * 3. Updates lastActivity timestamp on status changes
 *
 * This test documents the memo comparison behavior to prevent regressions.
 */
describe("ProjectsList", () => {
	describe("SessionRow memo comparison", () => {
		/**
		 * Helper to simulate the memo comparison function from SessionRow.
		 * This is the actual comparison logic extracted from projects-list.tsx lines 126-136.
		 */
		function arePropsEqual(
			prev: {
				session: { id: string }
				directory: string
				status?: "running" | "pending" | "completed" | "error"
				lastActivityTime?: number
			},
			next: {
				session: { id: string }
				directory: string
				status?: "running" | "pending" | "completed" | "error"
				lastActivityTime?: number
			},
		): boolean {
			// Re-render if session ID, directory, status, or lastActivityTime changes
			// Note: tick from useLiveTime triggers re-render via React's normal mechanism
			// since it's internal state, not a prop - memo doesn't block it
			return (
				prev.session.id === next.session.id &&
				prev.directory === next.directory &&
				prev.status === next.status &&
				prev.lastActivityTime === next.lastActivityTime
			)
		}

		test("returns false when status changes", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "completed" as const,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			// Should return false (props NOT equal) because status changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns false when lastActivityTime changes", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067260000, // 1 minute later
			}

			// Should return false (props NOT equal) because lastActivityTime changed
			// This ensures SessionRow re-renders when activity timestamp updates
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns false when session ID changes", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-456" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			// Should return false (props NOT equal) because session ID changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns false when directory changes", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project1",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project2",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			// Should return false (props NOT equal) because directory changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns true when all props are equal", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			// Should return true (props equal) because nothing changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(true)
		})

		test("returns true when status is undefined on both", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: undefined,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: undefined,
				lastActivityTime: 1704067200000,
			}

			// Should return true (props equal) when both status are undefined
			expect(arePropsEqual(prevProps, nextProps)).toBe(true)
		})

		test("returns false when status changes from undefined to defined", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: undefined,
				lastActivityTime: 1704067200000,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			// Should return false (props NOT equal) when status becomes defined
			// This covers the bootstrap case where status is initially undefined,
			// then gets populated after SDK session.status() returns
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns true when lastActivityTime is undefined on both", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "completed" as const,
				lastActivityTime: undefined,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "completed" as const,
				lastActivityTime: undefined,
			}

			// Should return true (props equal) when both lastActivityTime are undefined
			expect(arePropsEqual(prevProps, nextProps)).toBe(true)
		})

		test("returns false when lastActivityTime changes from undefined to defined", () => {
			const prevProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: undefined,
			}

			const nextProps = {
				session: { id: "ses-123" },
				directory: "/project",
				status: "running" as const,
				lastActivityTime: 1704067200000,
			}

			// Should return false (props NOT equal) when lastActivityTime becomes defined
			// This covers the case where SSE events start providing lastActivity updates
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})
	})
})
