/**
 * SSE Status Normalization (Gap 6)
 *
 * Backend sends status in multiple formats:
 * - "running" | "completed" (session.status events)
 * - "pending" | "active" | "done" (legacy events)
 * - { type: "idle" | "busy" | "retry" } (BackendSessionStatus)
 * - boolean isRunning (some contexts)
 *
 * This normalizes all formats to canonical SessionStatus ("running" | "completed").
 */

type BackendSessionStatus =
	| { type: "idle" }
	| { type: "busy" }
	| { type: "retry"; attempt: number; message: string; next: number }

/**
 * Normalize raw status value to canonical SessionStatus
 *
 * @param raw - Unknown status value from backend SSE events
 * @returns "running" | "completed"
 */
export function normalizeStatus(raw: unknown): "running" | "completed" {
	// Handle null/undefined
	if (raw == null) {
		return "completed"
	}

	// Handle boolean (isRunning)
	if (typeof raw === "boolean") {
		return raw ? "running" : "completed"
	}

	// Handle string formats (case-insensitive)
	if (typeof raw === "string") {
		const normalized = raw.toLowerCase().trim()

		// Canonical formats
		if (normalized === "running") return "running"
		if (normalized === "completed") return "completed"

		// Legacy formats that mean "running"
		if (normalized === "pending") return "running"
		if (normalized === "active") return "running"
		if (normalized === "busy") return "running"
		if (normalized === "retry") return "running"

		// Legacy formats that mean "completed"
		if (normalized === "done") return "completed"
		if (normalized === "idle") return "completed"
		if (normalized === "error") return "completed"

		// Unknown string - default to completed
		return "completed"
	}

	// Handle object formats (BackendSessionStatus and { type: string })
	if (typeof raw === "object" && raw !== null && "type" in raw) {
		const typeValue = (raw as { type: unknown }).type

		// Recursively normalize the type value (could be string)
		if (typeof typeValue === "string") {
			return normalizeStatus(typeValue)
		}

		// If type is not a string, default to completed
		return "completed"
	}

	// Unknown type - default to completed
	return "completed"
}
