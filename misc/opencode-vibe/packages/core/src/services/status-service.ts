/**
 * StatusService - Compute session status from multiple sources
 *
 * Implements the three-source session status logic:
 * 1. sessionStatus map (from SSE session.status events) - highest priority
 * 2. Sub-agent activity (Task parts with status="running")
 * 3. Last message check (assistant without completed time) - bootstrap edge case
 *
 * This is pure computation with no side effects, so uses 'sync' factory pattern.
 */

import { Effect } from "effect"
import type { SessionStatus } from "../types/events.js"

/**
 * Message shape for status computation
 */
export interface StatusMessage {
	id: string
	role: string
	time?: {
		created: number
		completed?: number
	}
}

/**
 * Part shape for status computation
 */
export interface StatusPart {
	messageId: string
	type: string
	tool?: string
	state?: {
		status?: string
	}
}

/**
 * Options for status computation
 */
export interface StatusComputationOptions {
	/**
	 * Include sub-agent activity in status check
	 * @default true
	 */
	includeSubAgents?: boolean

	/**
	 * Include last message check (bootstrap edge case)
	 * @default false
	 */
	includeLastMessage?: boolean
}

/**
 * Input for computeStatus
 */
export interface ComputeStatusInput {
	sessionId: string
	sessionStatusMap: Record<string, SessionStatus>
	messages: StatusMessage[]
	parts: StatusPart[]
	options?: StatusComputationOptions
}

/**
 * StatusService - Effect service for session status computation
 *
 * Pure computation service with no lifecycle management.
 * Uses 'sync' factory pattern.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* (_) {
 *   const service = yield* _(StatusService)
 *   return service.computeStatus({
 *     sessionId: "ses-123",
 *     sessionStatusMap: { "ses-123": "running" },
 *     messages: [],
 *     parts: []
 *   })
 * })
 *
 * const status = await runWithRuntime(program)
 * ```
 */
export class StatusService extends Effect.Service<StatusService>()("StatusService", {
	sync: () => ({
		/**
		 * Compute session status from multiple sources
		 *
		 * Priority order:
		 * 1. sessionStatus map with "running" status
		 * 2. Sub-agent activity (if enabled)
		 * 3. Last message check (if enabled)
		 * 4. sessionStatus map fallback or "completed"
		 *
		 * @param input - Status computation input
		 * @returns Session status
		 */
		computeStatus: (input: ComputeStatusInput): SessionStatus => {
			const { sessionId, sessionStatusMap, messages, parts, options = {} } = input
			const { includeSubAgents = true, includeLastMessage = false } = options

			// SOURCE 1: Main session status from map (highest priority if "running")
			const mainStatus = sessionStatusMap[sessionId] ?? "completed"
			if (mainStatus === "running") {
				return "running"
			}

			// SOURCE 2: Sub-agent activity (task parts with status="running")
			if (includeSubAgents) {
				for (const part of parts) {
					if (part.type === "tool" && part.tool === "task" && part.state?.status === "running") {
						return "running"
					}
				}
			}

			// SOURCE 3: Last message check (bootstrap edge case)
			if (includeLastMessage && messages.length > 0) {
				const lastMessage = messages[messages.length - 1]
				if (lastMessage.role === "assistant" && !lastMessage.time?.completed) {
					return "running"
				}
			}

			// Fallback to main status or "completed"
			return mainStatus
		},
	}),
}) {}
