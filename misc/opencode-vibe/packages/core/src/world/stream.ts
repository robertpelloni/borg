/**
 * World Stream - Reactive SSE consumer with async iterator
 *
 * Creates a handle for subscribing to world state changes via SSE.
 * Provides sync subscription API and async iterator for streaming.
 *
 * SELF-CONTAINED: Uses WorldSSE for discovery and connections.
 * No dependencies on browser APIs or proxy routes.
 *
 * IMPLEMENTATION NOTE: Delegates to createMergedWorldStream with empty sources.
 * This eliminates ~80 lines of duplication while preserving the API.
 */

import type { WorldStreamConfig, WorldStreamHandle } from "./types.js"
import { createMergedWorldStream } from "./merged-stream.js"

/**
 * Create a world stream from SSE events
 *
 * Delegates to createMergedWorldStream with no additional event sources.
 * This provides the same API while enabling future extension via merged streams.
 *
 * @example
 * ```typescript
 * // Auto-discover servers
 * const stream = createWorldStream()
 *
 * // Or explicit baseUrl
 * const stream = createWorldStream({ baseUrl: "http://localhost:1999" })
 *
 * // Subscribe API
 * const unsub = stream.subscribe((world) => console.log(world))
 *
 * // Async iterator API
 * for await (const world of stream) {
 *   console.log(world.sessions.length)
 * }
 *
 * await stream.dispose()
 * ```
 */
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
	// Delegate to merged stream with empty sources array
	// merged-stream.ts is the single source of truth for stream implementation
	return createMergedWorldStream({ ...config, sources: [] })
}

// Re-export types for convenience
export type { WorldState, WorldStreamConfig, WorldStreamHandle } from "./types.js"
