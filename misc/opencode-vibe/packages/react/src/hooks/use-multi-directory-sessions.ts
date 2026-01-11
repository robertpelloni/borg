/**
 * useMultiDirectorySessions - Get sessions from multiple directories
 *
 * Returns sessions from the Zustand store for multiple project directories.
 * Subscribes to real-time updates via SSE.
 *
 * @example
 * ```tsx
 * const sessions = useMultiDirectorySessions(["/project1", "/project2"])
 * // Returns: { "/project1": [Session...], "/project2": [Session...] }
 * ```
 */

"use client"

import { useEffect, useState } from "react"
import { formatRelativeTime } from "@opencode-vibe/core/utils"
import { useOpencodeStore } from "../store"

/**
 * Session in display format (for UI)
 */
export interface SessionDisplay {
	id: string
	title: string
	directory: string
	formattedTime: string
	timestamp: number
}

/**
 * Hook to get sessions from multiple directories
 *
 * Subscribes to store updates for all provided directories.
 * Returns sessions mapped by directory path.
 *
 * @param directories - Array of directory paths to get sessions for
 * @returns Record of directory -> SessionDisplay[]
 */
export function useMultiDirectorySessions(directories: string[]): Record<string, SessionDisplay[]> {
	const [liveSessions, setLiveSessions] = useState<Record<string, SessionDisplay[]>>({})

	/**
	 * Subscribe to store updates for all directories
	 */
	useEffect(() => {
		const directorySet = new Set(directories)

		const extractSessions = (
			state: ReturnType<typeof useOpencodeStore.getState>,
		): Record<string, SessionDisplay[]> => {
			const newSessions: Record<string, SessionDisplay[]> = {}

			for (const directory of directorySet) {
				const dirState = state.directories[directory]

				// Initialize empty array for directory even if not in store yet
				// This ensures the component always has a consistent shape to work with
				if (!dirState) {
					console.log(
						"[useMultiDirectorySessions] Directory not in store yet (will auto-init on first SSE event):",
						directory,
					)
					newSessions[directory] = []
					continue
				}

				const storeSessions: SessionDisplay[] = dirState.sessions.map((session) => ({
					id: session.id,
					title: session.title || "Untitled Session",
					directory,
					formattedTime: formatRelativeTime(session.time.updated || session.time.created),
					timestamp: session.time.updated || session.time.created,
				}))

				newSessions[directory] = storeSessions

				console.log(
					"[useMultiDirectorySessions] Extracted sessions for",
					directory,
					":",
					storeSessions.length,
				)
			}

			return newSessions
		}

		// Read initial state
		const initialSessions = extractSessions(useOpencodeStore.getState())
		console.log("[useMultiDirectorySessions] Initial state:", Object.keys(initialSessions))
		setLiveSessions(initialSessions)

		// Subscribe to future updates
		const unsubscribe = useOpencodeStore.subscribe((state) => {
			const updated = extractSessions(state)
			console.log(
				"[useMultiDirectorySessions] Store updated, re-extracting sessions:",
				Object.keys(updated),
			)
			setLiveSessions(updated)
		})

		console.log(
			"[useMultiDirectorySessions] Subscribed to store for directories:",
			Array.from(directorySet),
		)

		return () => {
			console.log("[useMultiDirectorySessions] Unsubscribing from store")
			unsubscribe()
		}
	}, [directories])

	return liveSessions
}
