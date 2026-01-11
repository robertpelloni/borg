/**
 * ServerDiscovery Effect Service
 *
 * Discovers running OpenCode servers via /api/opencode/servers endpoint.
 * Returns gracefully degraded results on failure (empty array).
 *
 * @module discovery
 */

import { Context, Effect, Layer } from "effect"

/**
 * Server information with URL included
 */
export interface ServerInfo {
	port: number
	directory: string
	url: string
}

/**
 * Raw server info from API (before URL transformation)
 */
interface RawServerInfo {
	port: number
	pid: number
	directory: string
}

/**
 * ServerDiscovery service interface
 */
export interface ServerDiscoveryService {
	/**
	 * Discover running OpenCode servers
	 * Returns empty array on failure (graceful degradation)
	 */
	discover: () => Effect.Effect<ServerInfo[], never, never>
}

/**
 * ServerDiscovery service tag for dependency injection
 */
export const ServerDiscovery = Context.GenericTag<ServerDiscoveryService>("ServerDiscovery")

/**
 * Type guard for RawServerInfo
 */
function isValidRawServer(data: unknown): data is RawServerInfo {
	if (!data || typeof data !== "object") return false
	const obj = data as Record<string, unknown>
	return typeof obj.port === "number" && typeof obj.directory === "string"
}

/**
 * Transform raw server info to ServerInfo (adds url field)
 */
function transformServer(raw: RawServerInfo): ServerInfo {
	return {
		port: raw.port,
		directory: raw.directory,
		url: `/api/opencode/${raw.port}`,
	}
}

/**
 * Create ServerDiscovery implementation with injectable fetch
 */
function makeServerDiscovery(fetchFn: typeof fetch = fetch): ServerDiscoveryService {
	return {
		discover: () =>
			Effect.gen(function* () {
				// Fetch from API endpoint
				const response = yield* Effect.tryPromise({
					try: () => fetchFn("/api/opencode/servers"),
					catch: () => new Error("Failed to fetch servers"),
				})

				// Check response status
				if (!response.ok) {
					return []
				}

				// Parse JSON
				const data = yield* Effect.tryPromise({
					try: () => response.json(),
					catch: () => new Error("Failed to parse JSON"),
				})

				// Validate and transform
				if (!Array.isArray(data)) {
					return []
				}

				const servers = data.filter(isValidRawServer).map(transformServer)
				return servers
			}).pipe(
				// On ANY error, return empty array (graceful degradation)
				Effect.catchAll(() => Effect.succeed([])),
			),
	}
}

/**
 * Default ServerDiscovery implementation using global fetch
 */
const ServerDiscoveryLive = Layer.succeed(ServerDiscovery, makeServerDiscovery())

/**
 * Default ServerDiscovery layer
 */
export const Default = ServerDiscoveryLive

/**
 * Create a test layer with custom fetch implementation
 * @internal
 */
export const makeTestLayer = (fetchFn: typeof fetch) =>
	Layer.succeed(ServerDiscovery, makeServerDiscovery(fetchFn))
