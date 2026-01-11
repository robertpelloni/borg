/**
 * @opencode-vibe/core/sse
 *
 * Server-Sent Events (SSE) streaming for real-time updates
 */

export {
	MultiServerSSE,
	multiServerSSE,
	// Backoff constants
	BASE_BACKOFF_MS,
	MAX_BACKOFF_MS,
	HEALTH_TIMEOUT_MS,
	// Utility functions
	calculateBackoff,
	// Types
	type ConnectionState,
	type DiscoveredServer,
	type SSEState,
} from "./multi-server-sse.js"
export { normalizeStatus } from "./normalize-status.js"
