/**
 * World Stream Types - ADR-018 Reactive World Stream
 *
 * These types define the enriched world state that combines sessions, messages,
 * parts, and status into a reactive stream of the complete OpenCode state.
 */

import type { Message, Part, Session } from "../types/domain.js"
import type { Project } from "../types/sdk.js"
import type { SessionStatus } from "../types/events.js"

/**
 * Instance represents a running OpenCode server process.
 * Discovered at runtime via lsof/proxy - NOT part of SDK.
 *
 * Key distinction: Project (SDK type) is persistent metadata,
 * Instance is runtime discovery for routing live interactions.
 */
export interface Instance {
	/** Server port */
	port: number
	/** Process ID */
	pid: number
	/** Project worktree path - links to Project */
	directory: string
	/** Connection status */
	status: "connected" | "connecting" | "disconnected" | "error"
	/** Base URL for API calls */
	baseUrl: string
	/** Last seen timestamp for stale detection */
	lastSeen: number
}

/**
 * Enriched session with status, messages, and computed properties
 */
export interface EnrichedSession extends Session {
	status: SessionStatus
	isActive: boolean
	messages: EnrichedMessage[]
	unreadCount: number
	contextUsagePercent: number
	lastActivityAt: number
}

/**
 * Enriched message with parts and streaming state
 */
export interface EnrichedMessage extends Message {
	parts: Part[]
	isStreaming: boolean
}

/**
 * Enriched project with instances and aggregated sessions.
 * Extends SDK Project type with runtime discovery and computed state.
 *
 * Key insight: Project can have MANY instances (same worktree, different ports/pids).
 * Sessions are PROJECT-BOUND but live interaction routes to INSTANCE.
 */
export interface EnrichedProject extends Project {
	/** All running instances for this project */
	instances: Instance[]
	/** Count of connected instances */
	activeInstanceCount: number
	/** Aggregated sessions from all instances */
	sessions: EnrichedSession[]
	/** Total session count */
	sessionCount: number
	/** Count of running sessions */
	activeSessionCount: number
	/** Most recent activity across all sessions */
	lastActivityAt: number
}

/**
 * World state statistics
 */
export interface WorldStats {
	/** Total number of sessions */
	total: number
	/** Number of active (running) sessions */
	active: number
	/** Number of sessions with streaming messages */
	streaming: number
}

/**
 * Complete world state snapshot
 */
export interface WorldState {
	// Session layer (existing - unchanged)
	sessions: EnrichedSession[]
	activeSessionCount: number
	activeSession: EnrichedSession | null
	connectionStatus: "connecting" | "connected" | "disconnected" | "error"
	lastUpdated: number

	/**
	 * Sessions grouped by directory
	 * Pre-computed to avoid adapter pattern in consumers
	 */
	byDirectory: Map<string, EnrichedSession[]>

	/**
	 * Pre-computed statistics
	 */
	stats: WorldStats

	// Instance layer (new - runtime discovery)
	/** All discovered instances */
	instances: Instance[]
	/** Quick lookup by port */
	instanceByPort: Map<number, Instance>
	/** Instances grouped by directory (Note: array! Multiple instances per project) */
	instancesByDirectory: Map<string, Instance[]>
	/** Count of connected instances */
	connectedInstanceCount: number

	// Project layer (new - aggregated from instances)
	/** All projects with enriched metadata */
	projects: EnrichedProject[]
	/** Quick lookup by directory/worktree */
	projectByDirectory: Map<string, EnrichedProject>

	// Routing layer (CRITICAL for correctness)
	/**
	 * Maps sessionID to owning Instance.
	 * REQUIRED for live interaction routing - GlobalBus is per-process.
	 * Without this map: POST to Instance B, SSE on Instance A = events DON'T APPEAR.
	 */
	sessionToInstance: Map<string, Instance>
}

/**
 * SSE event (for logging/debugging)
 */
export interface SSEEventInfo {
	/** Event source identifier (e.g., "sse", "swarm-db") */
	source?: string
	type: string
	properties: Record<string, unknown>
}

/**
 * Configuration for world stream
 */
export interface WorldStreamConfig {
	/**
	 * Base URL for SSE connection
	 * @default "http://localhost:1999"
	 */
	baseUrl?: string

	/**
	 * Maximum number of sessions to load
	 * @default undefined (load all)
	 */
	maxSessions?: number

	/**
	 * Auto-reconnect on disconnect
	 * @default true
	 */
	autoReconnect?: boolean

	/**
	 * Callback for raw SSE events (for logging/debugging)
	 */
	onEvent?: (event: SSEEventInfo) => void
}

/**
 * World stream handle for subscriptions
 */
export interface WorldStreamHandle {
	/**
	 * Subscribe to world state changes
	 * @returns Unsubscribe function
	 */
	subscribe(callback: (state: WorldState) => void): () => void

	/**
	 * Get current world state snapshot
	 */
	getSnapshot(): Promise<WorldState>

	/**
	 * Async iterator for world state changes
	 */
	[Symbol.asyncIterator](): AsyncIterableIterator<WorldState>

	/**
	 * Clean up resources
	 */
	dispose(): Promise<void>
}
