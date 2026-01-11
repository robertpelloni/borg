/**
 * useMessagesWithParts - Uses Core API to fetch messages with parts
 *
 * Fetches messages with parts pre-joined from Core layer via messages.listWithParts().
 * Transforms Core's MessageWithParts to React's OpencodeMessage format.
 *
 * This eliminates client-side joins - Core does the join at the data layer.
 *
 * @example
 * ```tsx
 * function SessionView({ sessionId }: { sessionId: string }) {
 *   const messages = useMessagesWithParts(sessionId)
 *
 *   return (
 *     <div>
 *       {messages.map(msg => (
 *         <div key={msg.info.id}>
 *           <p>{msg.info.role}</p>
 *           {msg.parts.map(p => <span key={p.id}>{p.content}</span>)}
 *         </div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */

"use client"

import { useMemo } from "react"
import type { Message, Part } from "@opencode-vibe/core/types"
import { useOpencodeStore } from "../../store"
import { useOpencode } from "../../providers"

export interface OpencodeMessage {
	/** Message metadata */
	info: Message
	/** Parts associated with this message */
	parts: Part[]
}

const EMPTY_MESSAGES: OpencodeMessage[] = []
const EMPTY_PARTS: Part[] = []

/**
 * Hook to get messages with their associated parts from store
 *
 * MIGRATION NOTE (ADR-016 Phase 2.5):
 * This hook now uses store data populated by SSE events.
 * Core's messages.listWithParts() is used for initial fetch/bootstrap
 * but SSE events keep the store updated in real-time.
 *
 * @param sessionId - Session ID to fetch messages for
 * @returns Array of messages with parts (empty array if none)
 */
export function useMessagesWithParts(sessionId: string): OpencodeMessage[] {
	const { directory } = useOpencode()

	// Select raw data from store - these are stable references from Immer
	const messages = useOpencodeStore((state) => state.directories[directory]?.messages[sessionId])
	const partsMap = useOpencodeStore((state) => state.directories[directory]?.parts)

	// Derive the combined structure with useMemo to avoid infinite loops
	// Only recomputes when messages or partsMap references change
	return useMemo(() => {
		if (!messages) return EMPTY_MESSAGES

		return messages.map((message) => ({
			info: message,
			parts: partsMap?.[message.id] ?? EMPTY_PARTS,
		}))
	}, [messages, partsMap])
}
