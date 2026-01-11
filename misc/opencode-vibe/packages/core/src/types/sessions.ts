/**
 * Session-specific types
 *
 * Types related to session status from backend endpoints.
 */

/**
 * Backend session status format from /session/status endpoint
 *
 * This is the raw format returned by the backend. Core APIs should
 * normalize this to SessionStatus ("running" | "completed" | ...).
 */
export type BackendSessionStatus =
	| { type: "idle" }
	| { type: "busy" }
	| { type: "retry"; attempt: number; message: string; next: number }

/**
 * Normalize backend status format to SessionStatus
 *
 * @param backendStatus - Backend status object or undefined
 * @returns Normalized session status
 */
export function normalizeBackendStatus(
	backendStatus: BackendSessionStatus | undefined,
): "pending" | "running" | "completed" | "error" {
	if (!backendStatus || backendStatus.type === "idle") {
		return "completed"
	}

	if (backendStatus.type === "busy" || backendStatus.type === "retry") {
		return "running"
	}

	// Unreachable but TypeScript needs exhaustiveness check
	return "completed"
}
