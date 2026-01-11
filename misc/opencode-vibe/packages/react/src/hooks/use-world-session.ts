/**
 * useWorldSession - Get a single session by ID from world state
 *
 * Derives from useWorld() - no additional subscriptions needed.
 * Returns null if session not found.
 *
 * ARCHITECTURE (ADR-016, ADR-018):
 * - Derived hook that selects from useWorld()
 * - Uses useMemo for memoization to prevent unnecessary re-renders
 * - Returns null (not undefined) when session not found
 *
 * IMPORT CONSTRAINT:
 * - ONLY import from @opencode-vibe/core/world (for types)
 * - Import useWorld from ./use-world.js
 * - No Effect types
 *
 * @example
 * ```tsx
 * function SessionDetail({ sessionId }: { sessionId: string }) {
 *   const session = useWorldSession(sessionId)
 *
 *   if (!session) {
 *     return <div>Session not found</div>
 *   }
 *
 *   return (
 *     <div>
 *       <h2>{session.directory}</h2>
 *       <p>Status: {session.status}</p>
 *       <p>Context: {session.contextUsagePercent}%</p>
 *     </div>
 *   )
 * }
 * ```
 */

"use client"

import { useMemo } from "react"
import { useWorld } from "./use-world.js"
// Import from specific file to avoid barrel file pulling in Node.js-only deps
import type { EnrichedSession } from "@opencode-vibe/core/world/types"

/**
 * Get a single session by ID from world state
 *
 * @param sessionId - Session ID to lookup
 * @returns EnrichedSession if found, null otherwise
 */
export function useWorldSession(sessionId: string): EnrichedSession | null {
	const world = useWorld()

	return useMemo(() => {
		return world.sessions.find((s) => s.id === sessionId) ?? null
	}, [world.sessions, sessionId])
}
