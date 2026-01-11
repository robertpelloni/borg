/**
 * Cursor types for durable event streaming.
 *
 * EventOffset is a branded string type that MUST be lexicographically sortable.
 * Clients treat offsets as opaque tokens - they compare and store, but never parse.
 */

import { Schema as S } from "effect"

/**
 * EventOffset: opaque offset for cursor-based pagination.
 *
 * Pattern: /^[0-9]+$/
 * Lexicographic sorting: "10" < "100" < "2" < "20" (not numeric!)
 *
 * For proper numeric ordering, backend should zero-pad offsets.
 */
export const EventOffset = S.String.pipe(S.pattern(/^[0-9]+$/), S.brand("EventOffset"))

export type EventOffset = S.Schema.Type<typeof EventOffset>

/**
 * StreamCursor: client's position in the event stream.
 *
 * Used for resuming streams after disconnection.
 *
 * @example
 * ```typescript
 * const cursor = S.decodeSync(StreamCursor)({
 *   offset: "12345",
 *   timestamp: Date.now(),
 *   projectKey: "/path/to/project"
 * });
 * ```
 */
export const StreamCursor = S.Struct({
	offset: EventOffset,
	timestamp: S.Number,
	projectKey: S.String,
})

export type StreamCursor = S.Schema.Type<typeof StreamCursor>
