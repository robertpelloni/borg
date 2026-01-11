/**
 * useSSEState - React hook for observable SSE state
 *
 * Subscribes to MultiServerSSE state changes without polling.
 * Replaces setInterval-based polling in sse-debug-panel.
 *
 * @example
 * ```tsx
 * function SSEDebugPanel() {
 *   const { servers, discovering, connected } = useSSEState()
 *
 *   return (
 *     <div>
 *       {discovering && <Badge>Discovering...</Badge>}
 *       <p>Connected: {connected ? 'Yes' : 'No'}</p>
 *       <ul>
 *         {servers.map(s => (
 *           <li key={s.port}>Port {s.port}: {s.state}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */

import { useState, useEffect } from "react"
import { multiServerSSE, type SSEState } from "@opencode-vibe/core/sse"

/**
 * Subscribe to SSE state changes (observable pattern)
 * Returns current state and updates reactively on state changes.
 *
 * SSR-safe: Returns empty state on server, subscribes on client.
 */
export function useSSEState(): SSEState {
	const [state, setState] = useState<SSEState>(() => {
		// SSR safety: return empty state on server
		if (typeof window === "undefined") {
			return {
				servers: [],
				connections: [],
				discovering: false,
				connected: false,
			}
		}

		// Client: get current state immediately
		return multiServerSSE.getCurrentState()
	})

	useEffect(() => {
		// Subscribe to state changes
		const unsubscribe = multiServerSSE.onStateChange(setState)

		// Cleanup subscription on unmount
		return unsubscribe
	}, [])

	return state
}
