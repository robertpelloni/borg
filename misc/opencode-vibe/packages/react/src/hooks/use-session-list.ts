/**
 * useSessionList - Get sessions from Zustand store
 *
 * Returns sessions array from the store (updated via SSE).
 * No local state, no loading/error - just a selector.
 *
 * Filters out archived sessions automatically.
 *
 * Uses useMemo to avoid creating new array references on every render,
 * which would cause infinite loops with useSyncExternalStore.
 *
 * @example
 * ```tsx
 * function SessionList() {
 *   const sessions = useSessionList()
 *
 *   return (
 *     <ul>
 *       {sessions.map(s => <li key={s.id}>{s.title}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */

"use client"

import { useMemo } from "react"
import type { Session } from "../store/types"
import { useOpencodeStore } from "../store"
import { useOpencode } from "../providers"

const EMPTY_SESSIONS: Session[] = []

/**
 * Hook to get all sessions from the store
 *
 * Returns empty array if directory not initialized.
 * Session list updates automatically via SSE events.
 * Archived sessions are filtered out.
 *
 * @returns Array of sessions
 */
export function useSessionList(): Session[] {
	const { directory } = useOpencode()

	// Select raw sessions array - stable reference from Immer
	const sessions = useOpencodeStore((state) => state.directories[directory]?.sessions)

	// Filter in useMemo to avoid creating new array on every render
	return useMemo(() => {
		if (!sessions) return EMPTY_SESSIONS
		return sessions.filter((s) => !s.time?.archived)
	}, [sessions])
}
