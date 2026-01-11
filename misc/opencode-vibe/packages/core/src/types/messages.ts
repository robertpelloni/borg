/**
 * Message-related types
 *
 * Types for message-parts join operations.
 */

import type { Message, Part } from "./domain.js"

/**
 * Message with embedded parts array
 *
 * Used to eliminate client-side joins - parts are pre-joined to their parent message.
 */
export interface MessageWithParts extends Message {
	/**
	 * Parts belonging to this message (joined by messageID)
	 */
	parts: Part[]
}
