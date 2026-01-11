/**
 * Messages Atom - Pure Effect Programs
 *
 * Framework-agnostic Effect programs for message management.
 * Consumers (React hooks) should use Effect.runPromise to execute these programs.
 *
 * Provides:
 * - Message list fetching via SDK
 * - Sorted by ID (ULIDs are lexicographically sortable)
 *
 * @module atoms/messages
 */

import { Effect } from "effect"
import { createClient } from "../client/index.js"
import type { Message } from "../types/index.js"

/**
 * Message atom namespace with Effect programs
 */
export const MessageAtom = {
	/**
	 * Fetch all messages for a session, sorted by ID
	 *
	 * @param sessionId - Session ID to fetch messages for
	 * @param directory - Project directory (optional)
	 * @returns Effect program that yields Message[] or Error
	 *
	 * @example
	 * ```typescript
	 * import { Effect } from "effect"
	 * import { MessageAtom } from "@opencode/core/atoms"
	 *
	 * // Execute the Effect program
	 * const messages = await Effect.runPromise(
	 *   MessageAtom.list("session-123", "/my/project")
	 * )
	 *
	 * // Or compose with other Effects
	 * const program = Effect.gen(function* () {
	 *   const messages = yield* MessageAtom.list("session-123")
	 *   return messages.filter(m => m.role === "assistant")
	 * })
	 * ```
	 */
	list: (sessionId: string, directory?: string): Effect.Effect<Message[], Error> =>
		Effect.gen(function* () {
			// Pass sessionId for session-based routing (routes to correct server in multi-TUI setup)
			const client = yield* Effect.sync(() => createClient(directory, sessionId))

			const response = yield* Effect.tryPromise({
				try: (_signal) =>
					client.session.messages({
						path: { id: sessionId },
						query: { limit: 1000 }, // TODO: Pagination
					}),
				catch: (error) =>
					new Error(
						`Failed to fetch messages: ${error instanceof Error ? error.message : String(error)}`,
					),
			})

			// Extract messages from response (each item has { info: Message, parts: Part[] })
			// biome-ignore lint: API response type
			const messageList = (response.data || []).map((m: any) => m.info as Message)

			// Sort by ID for binary search (ULIDs are lexicographically sortable)
			return messageList.sort((a, b) => a.id.localeCompare(b.id))
		}),

	/**
	 * Fetch a single message by ID
	 *
	 * @param sessionId - Session ID containing the message
	 * @param messageId - Message ID
	 * @param directory - Project directory (optional)
	 * @returns Effect program that yields Message | null or Error
	 *
	 * @example
	 * ```typescript
	 * const message = await Effect.runPromise(
	 *   MessageAtom.get("session-123", "msg-456")
	 * )
	 * if (message) {
	 *   console.log(message.role, message.id)
	 * }
	 * ```
	 */
	get: (
		sessionId: string,
		messageId: string,
		directory?: string,
	): Effect.Effect<Message | null, Error> =>
		Effect.gen(function* () {
			// Fetch all messages and find the one we want
			// NOTE: SDK doesn't have a direct message.get endpoint
			const messages = yield* MessageAtom.list(sessionId, directory)
			return messages.find((m) => m.id === messageId) ?? null
		}),
}

// Export types for consumers
export type { Message }
