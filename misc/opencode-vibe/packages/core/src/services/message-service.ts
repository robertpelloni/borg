/**
 * MessageService - Join messages with parts
 *
 * Implements message-parts join logic to eliminate client-side joins.
 * Accepts messages and parts arrays, returns MessageWithParts[] with
 * parts pre-joined to their parent messages by messageID.
 *
 * This is pure computation with no side effects, so uses 'sync' factory pattern.
 */

import { Effect } from "effect"
import type { Message, Part } from "../types/domain.js"
import type { MessageWithParts } from "../types/messages.js"

/**
 * Input for listWithParts
 */
export interface ListWithPartsInput {
	messages: Message[]
	parts: Part[]
}

/**
 * MessageService - Effect service for message-parts join operations
 *
 * Pure computation service with no lifecycle management.
 * Uses 'sync' factory pattern.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const service = yield* _(MessageService)
 *   return service.listWithParts({
 *     messages: [...],
 *     parts: [...]
 *   })
 * })
 *
 * const messagesWithParts = await runWithRuntime(program)
 * ```
 */
export class MessageService extends Effect.Service<MessageService>()("MessageService", {
	sync: () => ({
		/**
		 * Join messages with their parts
		 *
		 * Takes messages and parts arrays, returns MessageWithParts[] with
		 * parts pre-joined to their parent messages by messageID.
		 *
		 * Implementation:
		 * - Preserves message order
		 * - Filters parts by messageID to match each message
		 * - Orphaned parts (no matching message) are ignored
		 * - Messages with no parts get empty parts array
		 *
		 * @param input - Messages and parts to join
		 * @returns Array of messages with embedded parts
		 */
		listWithParts: (input: ListWithPartsInput): MessageWithParts[] => {
			const { messages, parts } = input

			return messages.map((message) => ({
				...message,
				parts: parts.filter((part) => part.messageID === message.id),
			}))
		},
	}),
}) {}
