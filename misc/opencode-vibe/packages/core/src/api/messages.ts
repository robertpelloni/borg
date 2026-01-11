/**
 * Messages API - Promise-based wrapper
 *
 * Promise-based API for message operations.
 * Wraps MessageAtom Effect programs with Effect.runPromise.
 *
 * @module api/messages
 */

import { Effect } from "effect"
import { MessageAtom } from "../atoms/messages.js"
import { PartAtom } from "../atoms/parts.js"
import { MessageService } from "../services/message-service.js"
import { runWithRuntime } from "../runtime/run-with-runtime.js"
import type { Message, MessageWithParts } from "../types/index.js"

/**
 * Message API namespace
 *
 * Promise-based wrappers around MessageAtom.
 */
export const messages = {
	/**
	 * Fetch all messages for a session
	 *
	 * @param sessionId - Session ID to fetch messages for
	 * @param directory - Project directory (optional)
	 * @returns Promise that resolves to Message array
	 *
	 * @example
	 * ```typescript
	 * const messages = await messages.list("session-123")
	 * console.log(messages.length)
	 * ```
	 */
	list: (sessionId: string, directory?: string): Promise<Message[]> =>
		Effect.runPromise(MessageAtom.list(sessionId, directory)),

	/**
	 * Fetch a single message by ID
	 *
	 * @param sessionId - Session ID containing the message
	 * @param messageId - Message ID
	 * @param directory - Project directory (optional)
	 * @returns Promise that resolves to Message or null
	 *
	 * @example
	 * ```typescript
	 * const message = await messages.get("session-123", "msg-456")
	 * if (message) {
	 *   console.log(message.role, message.id)
	 * }
	 * ```
	 */
	get: (sessionId: string, messageId: string, directory?: string): Promise<Message | null> =>
		Effect.runPromise(MessageAtom.get(sessionId, messageId, directory)),

	/**
	 * Fetch messages with pre-joined parts for a session
	 *
	 * Fetches all messages for a session with parts pre-joined by messageID.
	 * This eliminates the need for client-side joins in React components.
	 *
	 * Uses MessageService to perform the join logic at the API layer.
	 *
	 * @param sessionId - Session ID to fetch messages for
	 * @param directory - Project directory (optional)
	 * @returns Promise that resolves to MessageWithParts[]
	 *
	 * @example
	 * ```typescript
	 * const messagesWithParts = await messages.listWithParts("ses-123")
	 * messagesWithParts.forEach(({ id, parts }) => {
	 *   console.log(`Message ${id} has ${parts.length} parts`)
	 * })
	 * ```
	 */
	listWithParts: (sessionId: string, directory?: string): Promise<MessageWithParts[]> =>
		runWithRuntime(
			Effect.gen(function* (_) {
				// Fetch messages and parts in parallel
				const [messages, parts] = yield* _(
					Effect.all(
						[MessageAtom.list(sessionId, directory), PartAtom.list(sessionId, directory)],
						{
							concurrency: 2,
						},
					),
				)

				// Use MessageService to join messages with parts
				const service = yield* _(MessageService)
				return service.listWithParts({ messages, parts })
			}),
		),
}

// Export types for consumers
export type { Message, MessageWithParts }
