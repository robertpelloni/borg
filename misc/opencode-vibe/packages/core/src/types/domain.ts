/**
 * Domain types for OpenCode entities
 *
 * Provides backward-compatible loose types while transitioning to strict SDK types.
 * New code should use SDK types directly from ./sdk.ts
 */

// Import SDK types for reference
import type { Session as SDKSession, Message as SDKMessage, Part as SDKPart } from "./sdk.js"

/**
 * Backward-compatible Session type (loose)
 * For strict typing, use SDKSession from ./sdk.ts
 */
export type Session = {
	id: string
	title: string
	directory: string
	parentID?: string
	projectID?: string
	version?: string | number // SDK uses string, old code used number
	time: {
		created: number
		updated: number
		archived?: number
	}
	summary?: {
		additions: number
		deletions: number
		files: number
		diffs?: unknown[]
	}
	[key: string]: unknown
}

/**
 * Backward-compatible Message type (loose)
 * For strict typing, use SDKMessage from ./sdk.ts
 */
export type Message = {
	id: string
	sessionID: string
	role: string
	parentID?: string
	time?: { created: number; completed?: number }
	finish?: string
	tokens?: {
		input: number
		output: number
		reasoning?: number
		cache?: {
			read: number
			write: number
		}
	}
	agent?: string
	model?: {
		name?: string
		providerID?: string
		modelID?: string
		limits?: {
			context: number
			output: number
		}
	}
	summary?: unknown
	error?: unknown
	system?: string
	tools?: unknown
	mode?: string
	providerID?: string
	modelID?: string
	[key: string]: unknown
}

/**
 * Backward-compatible Part type (loose)
 * For strict typing, use SDKPart from ./sdk.ts
 *
 * sessionID made optional for test compatibility (real parts always have it)
 */
export type Part = {
	id: string
	sessionID?: string // Optional for test mocks
	messageID: string
	type: string
	content?: string
	text?: string
	tool?: string
	state?: {
		status?: string
		[key: string]: unknown
	}
	time?: {
		start: number
		end?: number
	}
	[key: string]: unknown
}

/**
 * Backward-compatible SessionStatus type (loose string union)
 * For strict typing, use SessionStatus from ./sdk.ts (object discriminated union)
 */
export type SessionStatusCompat = "pending" | "running" | "completed" | "error" | "idle"

/**
 * Session with computed status
 * Used for rendering session lists with real-time status
 */
export interface SessionWithStatus {
	session: Session
	status: SessionStatusCompat
}
