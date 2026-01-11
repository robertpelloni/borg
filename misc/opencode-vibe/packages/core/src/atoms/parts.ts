/**
 * Parts Atom - Pure Effect Programs
 *
 * Framework-agnostic Effect programs for message parts management.
 * Consumers (React hooks) should use Effect.runPromise to execute these programs.
 *
 * Provides:
 * - Part list fetching via SDK (from session.messages)
 * - Sorted by ID (ULIDs are lexicographically sortable)
 * - Filtered by sessionId (parts belong to messages in a session)
 *
 * @module atoms/parts
 */

import { Effect } from "effect"
import { createClient } from "../client/index.js"
import type { Part } from "../types/index.js"

/**
 * Part atom namespace with Effect programs
 */
export const PartAtom = {
	/**
	 * Fetch all parts for a session, sorted by ID
	 *
	 * Parts are extracted from the session.messages response.
	 * Each message contains an array of parts.
	 *
	 * @param sessionId - Session ID to fetch parts for
	 * @param directory - Project directory (optional)
	 * @returns Effect program that yields Part[] or Error
	 *
	 * @example
	 * ```typescript
	 * import { Effect } from "effect"
	 * import { PartAtom } from "@opencode/core/atoms"
	 *
	 * // Execute the Effect program
	 * const parts = await Effect.runPromise(
	 *   PartAtom.list("session-123", "/my/project")
	 * )
	 *
	 * // Or compose with other Effects
	 * const program = Effect.gen(function* () {
	 *   const parts = yield* PartAtom.list("session-123")
	 *   return parts.filter(p => p.type === "tool_call")
	 * })
	 * ```
	 */
	list: (sessionId: string, directory?: string): Effect.Effect<Part[], Error> =>
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
						`Failed to fetch parts: ${error instanceof Error ? error.message : String(error)}`,
					),
			})

			// Extract parts from response (each item has { info: Message, parts: Part[] })
			// biome-ignore lint: API response type
			const responseData = (response.data || []) as any[]

			const allParts: Part[] = []

			for (const item of responseData) {
				const messageParts = (item.parts || []) as Part[]
				allParts.push(...messageParts)
			}

			// Sort by ID for binary search (ULIDs are lexicographically sortable)
			return allParts.sort((a, b) => a.id.localeCompare(b.id))
		}),

	/**
	 * Fetch a single part by ID
	 *
	 * @param sessionId - Session ID containing the part
	 * @param partId - Part ID
	 * @param directory - Project directory (optional)
	 * @returns Effect program that yields Part | null or Error
	 *
	 * @example
	 * ```typescript
	 * const part = await Effect.runPromise(
	 *   PartAtom.get("session-123", "part-456")
	 * )
	 * if (part) {
	 *   console.log(part.type, part.content)
	 * }
	 * ```
	 */
	get: (sessionId: string, partId: string, directory?: string): Effect.Effect<Part | null, Error> =>
		Effect.gen(function* () {
			// Fetch all parts and find the one we want
			// NOTE: SDK doesn't have a direct part.get endpoint
			const parts = yield* PartAtom.list(sessionId, directory)
			return parts.find((p) => p.id === partId) ?? null
		}),
}

// Export types for consumers
export type { Part }
