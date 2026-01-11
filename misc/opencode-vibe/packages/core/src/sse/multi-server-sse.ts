/**
 * Multi-Server SSE Manager
 *
 * Discovers all running opencode servers on the local machine and subscribes
 * to their SSE event streams. Aggregates session.status events from all servers
 * into a unified stream.
 *
 * Architecture:
 * - Polls /api/opencode/servers to discover running servers
 * - Maintains SSE connections to each discovered server
 * - Reconnects automatically on disconnect with exponential backoff
 * - Cleans up connections when servers die
 * - Monitors connection health (force reconnect if no events for 60s)
 *
 * @example
 * ```tsx
 * const manager = new MultiServerSSE()
 * manager.start()
 * manager.onStatus((update) => {
 *   store.handleEvent(update.directory, {
 *     type: "session.status",
 *     properties: { sessionID: update.sessionID, status: update.status },
 *   })
 * })
 * // Later:
 * manager.stop()
 * ```
 */

import { EventSourceParserStream } from "eventsource-parser/stream"
import type { ConnectionState, DiscoveredServer, SSEState } from "../types/events.js"
import { normalizeStatus } from "./normalize-status.js"

/**
 * Backoff configuration for reconnection attempts
 */
export const BASE_BACKOFF_MS = 1000 // 1 second
export const MAX_BACKOFF_MS = 30000 // 30 seconds
const JITTER_FACTOR = 0.2 // Add up to 20% jitter

/**
 * Health monitoring configuration
 */
export const HEALTH_TIMEOUT_MS = 60000 // 60 seconds without events triggers reconnect
const HEALTH_CHECK_INTERVAL_MS = 10000 // Check health every 10 seconds

// Re-export canonical types
export type { ConnectionState, DiscoveredServer, SSEState }

/**
 * Calculate exponential backoff with jitter
 * Formula: min(baseDelay * 2^attempt, maxDelay) + random jitter (0-20%)
 */
export function calculateBackoff(attempt: number): number {
	const baseDelay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
	const jitter = baseDelay * Math.random() * JITTER_FACTOR
	return baseDelay + jitter
}

interface StatusUpdate {
	directory: string
	sessionID: string
	status: "running" | "completed"
}

type StatusCallback = (update: StatusUpdate) => void

/**
 * Full SSE event from a server
 */
interface SSEEvent {
	directory: string
	payload: { type: string; properties: Record<string, unknown> }
}

type EventCallback = (event: SSEEvent) => void

export class MultiServerSSE {
	private connections = new Map<number, AbortController>()
	private statusCallbacks: StatusCallback[] = []
	private eventCallbacks: EventCallback[] = []
	private stateChangeCallbacks: ((state: SSEState) => void)[] = []
	private discoveryInterval?: ReturnType<typeof setInterval>
	private healthCheckInterval?: ReturnType<typeof setInterval>
	private started = false
	private paused = false
	private visibilityHandler?: () => void

	// Directory -> Ports mapping (multiple servers can run for same directory)
	private directoryToPorts = new Map<string, number[]>()

	// Session -> Port cache (tracks which server sent events for which session)
	private sessionToPort = new Map<string, number>()

	// Connection state tracking for observability
	private connectionStates = new Map<number, ConnectionState>()

	// Last event time per connection for health monitoring
	private lastEventTimes = new Map<number, number>()

	// Backoff attempt counters per connection
	private backoffAttempts = new Map<number, number>()

	constructor(private discoveryIntervalMs = 5000) {} // 5s - need fast discovery for good UX

	/**
	 * Get all ports for a directory
	 */
	getPortsForDirectory(directory: string): number[] {
		return this.directoryToPorts.get(directory) ?? []
	}

	/**
	 * Get the port for a specific session (if we've seen events from it)
	 */
	getPortForSession(sessionId: string): number | undefined {
		return this.sessionToPort.get(sessionId)
	}

	/**
	 * Get the base URL for a session's server (preferred) or directory's server (fallback)
	 */
	getBaseUrlForSession(sessionId: string, directory: string): string | undefined {
		// First, check if we know which server owns this session
		const sessionPort = this.sessionToPort.get(sessionId)
		if (sessionPort) {
			return `/api/opencode/${sessionPort}`
		}

		// Fallback to first port for directory
		const ports = this.directoryToPorts.get(directory)
		return ports?.[0] ? `/api/opencode/${ports[0]}` : undefined
	}

	/**
	 * Get the base URL for a directory's server (first one if multiple)
	 * Returns undefined if no server found for this directory
	 */
	getBaseUrlForDirectory(directory: string): string | undefined {
		const ports = this.directoryToPorts.get(directory)
		return ports?.[0] ? `/api/opencode/${ports[0]}` : undefined
	}

	/**
	 * Check if any connections are established and healthy
	 */
	isConnected(): boolean {
		for (const state of this.connectionStates.values()) {
			if (state === "connected") return true
		}
		return false
	}

	/**
	 * Check if initial server discovery has completed
	 * Discovery is considered complete once we have at least one connection
	 * (either connected or attempting to connect)
	 */
	isDiscoveryComplete(): boolean {
		return this.connectionStates.size > 0
	}

	/**
	 * Get list of discovered servers with their connection state and directory
	 * Useful for debugging and status displays
	 */
	getDiscoveredServers(): Array<{
		port: number
		directory: string
		state: ConnectionState
		lastEventTime?: number
	}> {
		const servers: Array<{
			port: number
			directory: string
			state: ConnectionState
			lastEventTime?: number
		}> = []

		// Build a map of port -> directory for quick lookup
		const portToDirectory = new Map<number, string>()
		for (const [directory, ports] of this.directoryToPorts) {
			for (const port of ports) {
				portToDirectory.set(port, directory)
			}
		}

		// Get all known ports (from connections and directory mappings)
		const allPorts = new Set([...this.connectionStates.keys(), ...portToDirectory.keys()])

		for (const port of allPorts) {
			const directory = portToDirectory.get(port) ?? "unknown"
			const state = this.connectionStates.get(port) ?? "disconnected"
			const lastEventTime = this.lastEventTimes.get(port)

			servers.push({
				port,
				directory,
				state,
				lastEventTime,
			})
		}

		return servers.sort((a, b) => a.port - b.port)
	}

	/**
	 * Get detailed connection status for all servers
	 */
	getConnectionStatus(): Map<number, ConnectionState> {
		return new Map(this.connectionStates)
	}

	/**
	 * Get last event time per connection for health monitoring
	 */
	getConnectionHealth(): Map<number, number> {
		return new Map(this.lastEventTimes)
	}

	/**
	 * Get current SSE state snapshot
	 * Used for immediate state access and initial hook state
	 */
	getCurrentState(): SSEState {
		// Convert getDiscoveredServers() output to match DiscoveredServer type
		const servers = this.getDiscoveredServers().map((server) => {
			// Build port -> directory map for session lookup
			const sessions: string[] = []
			for (const [sessionId, port] of this.sessionToPort) {
				if (port === server.port) {
					sessions.push(sessionId)
				}
			}

			return {
				port: server.port,
				pid: 0, // We don't track PID in runtime state (only from discovery)
				directory: server.directory,
				sessions: sessions.length > 0 ? sessions : undefined,
			}
		})

		// Convert connection states to tuples with extended metadata
		const connections: [number, { state: ConnectionState; lastEventTime?: number }][] = []
		for (const [port, state] of this.connectionStates) {
			connections.push([
				port,
				{
					state,
					lastEventTime: this.lastEventTimes.get(port),
				},
			])
		}

		return {
			servers,
			connections,
			discovering: this.started && !this.isDiscoveryComplete(),
			connected: this.isConnected(),
		}
	}

	/**
	 * Subscribe to SSE state changes (observable pattern)
	 * Callback is called immediately with current state, then on every state change.
	 *
	 * @returns Unsubscribe function
	 */
	onStateChange(callback: (state: SSEState) => void): () => void {
		this.stateChangeCallbacks.push(callback)

		// Emit current state immediately
		try {
			callback(this.getCurrentState())
		} catch (e) {
			console.error("[MultiServerSSE] State change callback error:", e)
		}

		// Return unsubscribe function
		return () => {
			const index = this.stateChangeCallbacks.indexOf(callback)
			if (index > -1) {
				this.stateChangeCallbacks.splice(index, 1)
			}
		}
	}

	/**
	 * Emit state change to all subscribers
	 * Called when: discovery completes, server added/removed, connection state changes
	 */
	private emitStateChange() {
		const state = this.getCurrentState()
		for (const cb of this.stateChangeCallbacks) {
			try {
				cb(state)
			} catch (e) {
				console.error("[MultiServerSSE] State change callback error:", e)
			}
		}
	}

	/**
	 * Start discovering servers and subscribing to their events
	 */
	start() {
		if (this.started) return
		this.started = true

		console.debug("[MultiServerSSE] Starting server discovery and SSE connections")

		// Emit state change (discovering: false → true)
		this.emitStateChange()

		// Discover immediately on start
		this.discover()
		this.discoveryInterval = setInterval(() => {
			if (!this.paused) this.discover()
		}, this.discoveryIntervalMs)

		// Start health monitoring
		this.healthCheckInterval = setInterval(() => {
			if (!this.paused) this.checkConnectionHealth()
		}, HEALTH_CHECK_INTERVAL_MS)

		// Pause polling when tab is hidden, resume when visible
		if (typeof document !== "undefined") {
			this.visibilityHandler = () => {
				this.paused = document.hidden
				// Discover immediately when tab becomes visible again
				if (!document.hidden && this.started) {
					console.debug("[MultiServerSSE] Tab visible, resuming discovery")
					this.discover()
				}
			}
			document.addEventListener("visibilitychange", this.visibilityHandler)
		}
	}

	/**
	 * Stop all connections and discovery
	 */
	stop() {
		console.debug("[MultiServerSSE] Stopping all connections")
		this.started = false

		if (this.discoveryInterval) {
			clearInterval(this.discoveryInterval)
			this.discoveryInterval = undefined
		}

		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = undefined
		}

		if (this.visibilityHandler && typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.visibilityHandler)
			this.visibilityHandler = undefined
		}

		for (const [port, controller] of this.connections) {
			this.setConnectionState(port, "disconnected")
			controller.abort()
		}
		this.connections.clear()
		this.connectionStates.clear()
		this.lastEventTimes.clear()
		this.backoffAttempts.clear()
	}

	/**
	 * Check connection health and force reconnect for stale connections
	 */
	private checkConnectionHealth() {
		const now = Date.now()

		for (const [port, lastEventTime] of this.lastEventTimes) {
			const timeSinceLastEvent = now - lastEventTime

			if (timeSinceLastEvent > HEALTH_TIMEOUT_MS) {
				console.debug(
					`[MultiServerSSE] Connection to port ${port} unhealthy (no events for ${Math.round(timeSinceLastEvent / 1000)}s), forcing reconnect`,
				)

				// Abort the current connection - the reconnect loop will restart
				const controller = this.connections.get(port)
				if (controller) {
					this.setConnectionState(port, "disconnected")
					controller.abort()
					this.connections.delete(port)
					// Reset backoff for health-triggered reconnect
					this.backoffAttempts.set(port, 0)
					// Reconnect immediately
					this.connectToServer(port)
				}
			}
		}
	}

	/**
	 * Update connection state and log the change
	 * Emits state change to subscribers when state changes
	 */
	private setConnectionState(port: number, state: ConnectionState) {
		const previousState = this.connectionStates.get(port)
		if (previousState !== state) {
			this.connectionStates.set(port, state)
			console.debug(`[MultiServerSSE] Port ${port}: ${previousState ?? "none"} → ${state}`)
			this.emitStateChange()
		}
	}

	/**
	 * Record that we received an event from a connection (for health monitoring)
	 */
	private recordEventReceived(port: number) {
		this.lastEventTimes.set(port, Date.now())
	}

	/**
	 * Subscribe to status updates from all servers
	 * @returns Unsubscribe function
	 */
	onStatus(callback: StatusCallback): () => void {
		this.statusCallbacks.push(callback)
		return () => {
			this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback)
		}
	}

	/**
	 * Subscribe to ALL events from all servers (messages, parts, etc.)
	 * @returns Unsubscribe function
	 */
	onEvent(callback: EventCallback): () => void {
		this.eventCallbacks.push(callback)
		return () => {
			this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback)
		}
	}

	private emitStatus(update: StatusUpdate) {
		for (const cb of this.statusCallbacks) {
			try {
				cb(update)
			} catch (e) {
				console.error("[MultiServerSSE] Status callback error:", e)
			}
		}
	}

	private emitEvent(event: SSEEvent) {
		for (const cb of this.eventCallbacks) {
			try {
				cb(event)
			} catch (e) {
				console.error("[MultiServerSSE] Event callback error:", e)
			}
		}
	}

	private async discover() {
		try {
			const response = await fetch("/api/opencode/servers")
			if (!response.ok) {
				console.warn("[MultiServerSSE] Discovery failed:", response.status)
				return
			}

			const servers: DiscoveredServer[] = await response.json()
			const activePorts = new Set(servers.map((s) => s.port))

			// Update directory -> ports mapping (multiple servers per directory)
			this.directoryToPorts.clear()
			for (const server of servers) {
				const existing = this.directoryToPorts.get(server.directory) ?? []
				existing.push(server.port)
				this.directoryToPorts.set(server.directory, existing)
			}

			// Pre-populate sessionToPort cache from discovery response
			// This fixes web→TUI routing on page load (before SSE events arrive)
			for (const server of servers) {
				if (server.sessions) {
					for (const sessionId of server.sessions) {
						this.sessionToPort.set(sessionId, server.port)
					}
				}
			}

			// Clean up sessionToPort cache - remove entries for dead servers
			for (const [sessionId, port] of this.sessionToPort) {
				if (!activePorts.has(port)) {
					this.sessionToPort.delete(sessionId)
				}
			}

			// Remove connections to dead servers
			let serversChanged = false
			for (const [port, controller] of this.connections) {
				if (!activePorts.has(port)) {
					controller.abort()
					this.connections.delete(port)
					serversChanged = true
				}
			}

			// Connect to new servers
			for (const server of servers) {
				if (!this.connections.has(server.port)) {
					this.connectToServer(server.port)
					serversChanged = true
				}
			}

			// Emit state change if servers were added or removed
			if (serversChanged) {
				this.emitStateChange()
			}
		} catch {
			// Discovery failed silently - will retry on next interval
		}
	}

	private async connectToServer(port: number) {
		const controller = new AbortController()
		this.connections.set(port, controller)
		this.setConnectionState(port, "connecting")

		// Initialize backoff counter if not present
		if (!this.backoffAttempts.has(port)) {
			this.backoffAttempts.set(port, 0)
		}

		while (!controller.signal.aborted && this.started) {
			try {
				const response = await fetch(`/api/sse/${port}`, {
					signal: controller.signal,
					headers: {
						Accept: "text/event-stream",
						"Cache-Control": "no-cache",
					},
				})

				if (!response.ok || !response.body) {
					throw new Error(`Failed to connect: ${response.status}`)
				}

				// Connection successful - reset backoff and update state
				this.backoffAttempts.set(port, 0)
				this.setConnectionState(port, "connected")
				this.recordEventReceived(port) // Mark connection time as last activity

				// Use EventSourceParserStream for proper SSE parsing
				const stream = response.body
					.pipeThrough(new TextDecoderStream())
					.pipeThrough(new EventSourceParserStream())

				const reader = stream.getReader()

				while (!controller.signal.aborted) {
					const { done, value } = await reader.read()
					if (done) break

					// Record activity for health monitoring
					this.recordEventReceived(port)

					try {
						// EventSourceParserStream returns ParsedEvent with data property
						const event = JSON.parse((value as { data: string }).data)

						// Log heartbeats at debug level
						if (event.payload?.type === "heartbeat") {
							console.debug(`[MultiServerSSE] Heartbeat received from port ${port}`)
						}

						this.handleEvent(port, event)
					} catch {
						// Parse error - skip malformed event
					}
				}
			} catch (error) {
				if (controller.signal.aborted) break

				// Update state and calculate backoff
				this.setConnectionState(port, "disconnected")
				const attempt = this.backoffAttempts.get(port) ?? 0
				const delay = calculateBackoff(attempt)

				console.debug(
					`[MultiServerSSE] Connection to port ${port} failed (attempt ${attempt + 1}), retrying in ${Math.round(delay)}ms`,
				)

				// Increment attempt counter for next retry
				this.backoffAttempts.set(port, attempt + 1)

				// Wait before reconnecting with exponential backoff
				await new Promise((r) => setTimeout(r, delay))

				// Update state for retry
				if (!controller.signal.aborted && this.started) {
					this.setConnectionState(port, "connecting")
				}
			}
		}

		// Clean up on exit
		this.connections.delete(port)
		this.connectionStates.delete(port)
		this.lastEventTimes.delete(port)
		this.backoffAttempts.delete(port)
	}

	private handleEvent(
		port: number,
		event: {
			directory?: string
			payload?: { type?: string; properties?: Record<string, unknown> }
		},
	) {
		const directory = event.directory
		const payload = event.payload

		if (!directory || directory === "global") return
		if (!payload?.type || !payload.properties) return

		// Track which port owns which session based on events we receive
		const props = payload.properties
		const sessionID =
			(props.sessionID as string) ??
			(props.info as { sessionID?: string })?.sessionID ??
			(props.part as { sessionID?: string })?.sessionID

		if (sessionID) {
			this.sessionToPort.set(sessionID, port)
		}

		// Debug logging for ALL session-related events (session.created, session.updated, session.status)
		// This provides observability for session lifecycle events at the SSE layer
		if (payload.type.startsWith("session.")) {
			console.debug(`[MultiServerSSE] ${payload.type} event:`, {
				port,
				directory,
				sessionID,
				payload: props,
			})
		}

		// Emit ALL events to subscribers (messages, parts, status, etc.)
		this.emitEvent({
			directory,
			payload: payload as SSEEvent["payload"],
		})

		// Also emit status updates to legacy status-only subscribers
		if (payload.type === "session.status") {
			const { sessionID, status } = payload.properties as {
				sessionID: string
				status: unknown
			}
			if (sessionID && status != null) {
				// Normalize status to canonical format
				const normalizedStatus = normalizeStatus(status)
				this.emitStatus({ directory, sessionID, status: normalizedStatus })
			}
		}
	}
}

/**
 * Singleton instance for app-wide use
 */
export const multiServerSSE = new MultiServerSSE()
