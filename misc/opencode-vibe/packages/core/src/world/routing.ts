/**
 * Routing utilities for live interaction
 *
 * Pure functions that consume WorldState and return the correct Instance for routing.
 *
 * CRITICAL: sessionToInstance map is THE source for routing live sessions.
 * NO FALLBACK - fail explicitly if instance unknown (better than silently routing to wrong instance).
 *
 * Why NO FALLBACK: If sessionToInstance is unknown, routing to wrong instance means
 * GlobalBus events don't appear (events are per-process). Better to fail explicitly.
 */

import type { WorldState, Instance } from "./types.js"

/**
 * Get Instance for a session ID
 *
 * REQUIRED for live interaction routing - GlobalBus is per-process.
 * Without correct routing: POST to Instance B, SSE on Instance A = events DON'T APPEAR.
 *
 * @param worldState - Current world state snapshot
 * @param sessionId - Session ID to route
 * @returns Instance if found, null if not in sessionToInstance map
 */
export function getInstanceForSession(worldState: WorldState, sessionId: string): Instance | null {
	return worldState.sessionToInstance.get(sessionId) ?? null
}

/**
 * Get Instance for a project directory
 *
 * Used when only directory is known (e.g., creating new session).
 * Picks first connected instance, or first instance if none connected.
 *
 * @param worldState - Current world state snapshot
 * @param directory - Project directory path
 * @returns Instance if found, null if no instances for directory
 */
export function getInstanceForProject(worldState: WorldState, directory: string): Instance | null {
	const instances = worldState.instancesByDirectory.get(directory) ?? []

	if (instances.length === 0) {
		return null
	}

	// Prefer connected instance
	const connectedInstance = instances.find((i) => i.status === "connected")
	if (connectedInstance) {
		return connectedInstance
	}

	// Fallback to first instance (even if disconnected)
	return instances[0]
}

/**
 * Get route URL for API calls
 *
 * Routing logic:
 * 1. If sessionId provided, use sessionToInstance map (REQUIRED for live interaction)
 * 2. If sessionId not found but directory provided, fallback to instancesByDirectory
 * 3. If only directory provided, use instancesByDirectory
 * 4. Return null if no instance found (NO FALLBACK - fail explicitly)
 *
 * @param worldState - Current world state snapshot
 * @param options - Routing options
 * @returns Base URL if instance found, null otherwise
 */
export function getRouteUrl(
	worldState: WorldState,
	options: {
		sessionId?: string
		directory?: string
	},
): string | null {
	const { sessionId, directory } = options

	// Priority 1: sessionId (REQUIRED for live interaction)
	if (sessionId) {
		const instance = getInstanceForSession(worldState, sessionId)
		if (instance) {
			return instance.baseUrl
		}
		// Fallback to directory if sessionId not found but directory provided
		if (directory) {
			const dirInstance = getInstanceForProject(worldState, directory)
			return dirInstance?.baseUrl ?? null
		}
		return null
	}

	// Priority 2: directory only
	if (directory) {
		const instance = getInstanceForProject(worldState, directory)
		return instance?.baseUrl ?? null
	}

	// No routing info provided
	return null
}
