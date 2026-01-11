/**
 * Pure function utilities for SSE event filtering and state reduction
 *
 * These functions contain the testable core logic used by generic hooks.
 * NO React dependencies - just pure functions that can be tested in isolation.
 */

import type { GlobalEvent } from "../types/events"

/**
 * Check if an event type matches a filter
 *
 * Supports:
 * - Exact string match: "message.updated"
 * - Array of types: ["message.updated", "message.removed"]
 * - Wildcard prefix: "message.*" matches "message.updated", "message.removed", etc.
 *
 * @param eventType - The event type from the SSE event
 * @param filter - String or array of strings to match against
 * @returns true if event type matches filter
 */
export function matchesEventType(eventType: string, filter: string | string[]): boolean {
	const filters = Array.isArray(filter) ? filter : [filter]

	return filters.some((f) => {
		// Check for wildcard prefix (e.g., "message.*")
		if (f.endsWith(".*")) {
			const prefix = f.slice(0, -2) // Remove ".*"
			return eventType.startsWith(prefix + ".")
		}
		// Exact match
		return eventType === f
	})
}

/**
 * Check if an event matches a sessionId filter
 *
 * Returns true if:
 * - sessionId filter is undefined (no filtering)
 * - Event's sessionID property matches the filter
 *
 * @param event - The SSE event
 * @param sessionId - Optional sessionId to filter by
 * @returns true if event matches sessionId filter or no filter set
 */
export function matchesSessionId(event: GlobalEvent, sessionId?: string): boolean {
	// If no filter is set, match everything
	if (sessionId === undefined) {
		return true
	}

	// Extract sessionID from event properties
	const props = event.payload.properties as { sessionID?: string }
	return props.sessionID === sessionId
}

/**
 * Extract the item/entity from an event payload
 *
 * Different event types store the entity in different places:
 * - payload.properties.info (most common - Message, Session, etc.)
 * - payload.properties.item (some events)
 * - payload.properties.part (Part events - message.part.created/updated)
 * - payload.properties.message (some message events)
 *
 * Priority order: info > item > part > message
 *
 * @param payload - The event payload
 * @returns The extracted item or undefined if not found
 */
export function extractEventItem(payload: any): any {
	if (!payload.properties) {
		return undefined
	}

	const props = payload.properties as Record<string, any>

	// Priority order: info > item > part > message
	if (props.info !== undefined) {
		return props.info
	}
	if (props.item !== undefined) {
		return props.item
	}
	if (props.part !== undefined) {
		return props.part
	}
	if (props.message !== undefined) {
		return props.message
	}

	return undefined
}
