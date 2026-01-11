/**
 * useMultiDirectoryStatus - Track session status across multiple directories
 *
 * Returns session status (running/completed) for all sessions across multiple directories.
 * Implements cooldown logic to keep "running" indicator lit for 1 minute after streaming ends.
 *
 * @example
 * ```tsx
 * const { sessionStatuses, lastActivity } = useMultiDirectoryStatus(["/project1", "/project2"])
 * // sessionStatuses = { "ses-123": "running", "ses-456": "completed" }
 * // lastActivity = { "ses-123": 1704067200000, ... }
 * ```
 */

"use client"

import { useEffect, useState, useRef } from "react"
import { useOpencodeStore } from "../store"
import type { SessionStatus } from "../store/types"
import { createClient } from "@opencode-vibe/core/client"
import { computeStatusSync } from "@opencode-vibe/core/api"

/**
 * How long to keep "running" indicator lit after streaming ends
 *
 * **Why 1 minute?** Prevents UI flicker when AI streaming pauses briefly
 * between chunks. Without cooldown, the green dot would flash on/off rapidly
 * during normal streaming, creating a janky UX.
 *
 * **Tradeoff**: Indicator may stay green for up to 1 minute after session
 * actually completes. This is acceptable for better perceived smoothness.
 */
const IDLE_COOLDOWN_MS = 60_000 // 1 minute

/**
 * Derive bootstrap session status from API messages
 * A session is "busy" if the last message is an assistant message without a completed time
 *
 * @deprecated Use deriveSessionStatus from status-utils.ts for store-based status
 */
function deriveBootstrapStatus(
	messages: Array<{
		info: { role: string; time?: { created: number; completed?: number } }
	}>,
): "running" | "completed" {
	const lastMessage = messages[messages.length - 1]
	if (!lastMessage) return "completed"

	// Session is busy if last message is assistant without completed time
	if (lastMessage.info.role === "assistant" && !lastMessage.info.time?.completed) {
		return "running"
	}

	return "completed"
}

export interface UseMultiDirectoryStatusReturn {
	/** Map of sessionId -> status */
	sessionStatuses: Record<string, SessionStatus>
	/** Map of sessionId -> last activity timestamp */
	lastActivity: Record<string, number>
}

/**
 * Hook to manage session statuses across multiple directories
 *
 * **Two-phase approach**:
 * 1. **Bootstrap** (on mount): Fetches status for recent sessions (< 5min old)
 *    by checking if their last message is an incomplete assistant message.
 * 2. **SSE subscription**: Subscribes to store updates (which are fed by useSSEEvents)
 *    to get real-time session.status events.
 *
 * **Cooldown logic**: When a session becomes idle (status = "completed"),
 * the green indicator stays lit for 1 minute before fading. This prevents
 * flickering when AI streaming pauses briefly between chunks.
 *
 * @param directories - Array of directory paths with sessions to track
 * @param initialSessions - Optional initial session data for bootstrap (format: { dir: [{ id, formattedTime }] })
 * @returns Object with sessionStatuses and lastActivity maps
 */
export function useMultiDirectoryStatus(
	directories: string[],
	initialSessions?: Record<string, Array<{ id: string; formattedTime: string }>>,
): UseMultiDirectoryStatusReturn {
	const [sessionStatuses, setSessionStatuses] = useState<Record<string, SessionStatus>>({})
	const [lastActivity, setLastActivity] = useState<Record<string, number>>({})

	const bootstrappedRef = useRef(false)
	const cooldownTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

	// Cleanup all timers on unmount
	useEffect(() => {
		return () => {
			for (const timer of cooldownTimersRef.current.values()) {
				clearTimeout(timer)
			}
		}
	}, [])

	// Bootstrap session statuses for recent sessions on mount
	useEffect(() => {
		if (bootstrappedRef.current) return
		bootstrappedRef.current = true

		async function bootstrap() {
			if (!initialSessions) return

			// Fetch status for each directory in parallel
			await Promise.all(
				directories.map(async (directory) => {
					try {
						const client = await createClient(directory)

						// Fetch SDK session.status() for REAL status (not inferred)
						const statusResponse = await client.session.status()
						const backendStatusMap =
							(statusResponse.data as Record<string, { type: "idle" | "busy" | "retry" }> | null) ||
							{}

						// Normalize backend status format to SessionStatus
						const normalizedStatuses: Record<string, SessionStatus> = {}
						for (const [sessionId, backendStatus] of Object.entries(backendStatusMap)) {
							if (backendStatus.type === "busy" || backendStatus.type === "retry") {
								normalizedStatuses[sessionId] = "running"
							} else {
								normalizedStatuses[sessionId] = "completed"
							}
						}

						// Merge into state
						setSessionStatuses((prev) => ({
							...prev,
							...normalizedStatuses,
						}))
					} catch (error) {
						console.error(`Failed to fetch status for ${directory}:`, error)
					}
				}),
			)
		}

		bootstrap()
	}, [directories, initialSessions])

	/**
	 * Subscribe to session status changes from store using Core API
	 *
	 * Uses Core's computeStatusSync for consistent three-source status derivation:
	 * 1. sessionStatus map (SSE events)
	 * 2. Sub-agent activity (task parts with state.status="running")
	 * 3. Last message check (not used here - bootstrap only)
	 *
	 * **Batch selector pattern**: Single subscription gathers all session IDs,
	 * then derives status for each using Core API synchronously. This avoids
	 * Rules of Hooks violations (can't call hooks in loops).
	 *
	 * **Cooldown logic**:
	 * - When status = "running": Immediately set to "running", cancel any pending cooldown
	 * - When status = "completed": Start 1-minute cooldown timer, keep indicator green until timer expires
	 *
	 * **Metadata change detection** (VERIFIED bd-opencode-next--xts0a-mjvwegx7d89):
	 * - Store handler uses full replacement: parts[index] = part (not parts[index].state = ...)
	 * - Immer produces new object references on ANY nested mutation (including metadata changes)
	 * - Zustand subscription triggers on any state change → computeStatusSync re-runs
	 * - computeStatusSync checks part.state.status (not metadata), so metadata changes don't affect status
	 * - BUT: Subscription ensures we re-compute immediately when part.state.status does change
	 * - Characterization test confirms: metadata changes trigger re-computation as expected
	 */
	useEffect(() => {
		const directorySet = new Set(directories)

		const unsubscribe = useOpencodeStore.subscribe((state) => {
			for (const directory of directorySet) {
				const dirState = state.directories[directory]
				if (!dirState) continue

				// Get all session IDs from this directory
				const allSessionIds = new Set([
					...Object.keys(dirState.sessionStatus || {}),
					...Object.keys(dirState.messages || {}),
				])

				// Derive status for each session using Core API
				for (const sessionId of allSessionIds) {
					// Collect messages and parts for this session
					const sessionMessages = dirState.messages[sessionId] || []
					const messages = sessionMessages.map((m) => ({
						id: m.id,
						role: m.role || "user",
						time: m.time,
					}))
					const parts = sessionMessages.flatMap((msg) =>
						(dirState.parts[msg.id] || []).map((p) => ({
							messageId: p.messageID,
							type: p.type,
							tool: p.tool as string | undefined,
							state: p.state as { status?: string } | undefined,
						})),
					)

					// Call Core API to compute status synchronously
					const statusValue = computeStatusSync(
						sessionId,
						dirState.sessionStatus || {},
						messages,
						parts,
						{
							includeSubAgents: true,
							includeLastMessage: false, // Only for bootstrap
						},
					)

					// Debug log status changes
					const prevStatus = sessionStatuses[sessionId]
					if (prevStatus !== statusValue) {
						console.debug("[useMultiDirectoryStatus] status changed:", {
							sessionId,
							prevStatus,
							newStatus: statusValue,
							directory,
						})
					}

					if (statusValue === "running") {
						// Cancel any pending cooldown
						const existingTimer = cooldownTimersRef.current.get(sessionId)
						if (existingTimer) {
							clearTimeout(existingTimer)
							cooldownTimersRef.current.delete(sessionId)
						}

						setSessionStatuses((prev) => ({
							...prev,
							[sessionId]: "running",
						}))
						setLastActivity((prev) => ({
							...prev,
							[sessionId]: Date.now(),
						}))
					} else if (statusValue === "completed") {
						// Update last activity
						setLastActivity((prev) => ({
							...prev,
							[sessionId]: Date.now(),
						}))

						// Start cooldown
						const existingTimer = cooldownTimersRef.current.get(sessionId)
						if (existingTimer) {
							clearTimeout(existingTimer)
						}

						const timer = setTimeout(() => {
							setSessionStatuses((prev) => ({
								...prev,
								[sessionId]: "completed",
							}))
							cooldownTimersRef.current.delete(sessionId)
						}, IDLE_COOLDOWN_MS)

						cooldownTimersRef.current.set(sessionId, timer)
					}
				}
			}
		})

		return unsubscribe
	}, [directories, sessionStatuses])

	return { sessionStatuses, lastActivity }
}
