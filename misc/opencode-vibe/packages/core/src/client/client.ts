/**
 * Client routing utilities and SDK factory
 *
 * Provides routing logic and SDK client factory for OpenCode.
 */

import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client"
import { getServerForDirectory, getServerForSession, type ServerInfo } from "../discovery/index.js"
import { multiServerSSE } from "../sse/multi-server-sse.js"

export type { OpencodeClient }

/**
 * Default OpenCode server URL
 * Can be overridden via NEXT_PUBLIC_OPENCODE_URL env var
 */
export const OPENCODE_URL = process.env.NEXT_PUBLIC_OPENCODE_URL ?? "http://localhost:4056"

/**
 * Default proxy URL for browser clients
 * Extracts port from OPENCODE_URL and formats as Next.js API route
 */
const DEFAULT_PROXY_URL = (() => {
	try {
		const url = new URL(OPENCODE_URL)
		const port = url.port || "4056"
		return `/api/opencode/${port}`
	} catch {
		// Fallback if OPENCODE_URL is malformed
		return "/api/opencode/4056"
	}
})()

/**
 * Routing context for smart server discovery
 * Inject this from MultiServerSSE or other discovery mechanisms
 */
export interface RoutingContext {
	/** Available servers from discovery */
	servers: ServerInfo[]
	/** Optional session->port cache for session-specific routing */
	sessionToPort?: Map<string, number>
}

/**
 * Get the appropriate server URL for a client request
 *
 * Priority: session-specific routing > directory routing > default server
 *
 * @param directory - Optional project directory for scoping
 * @param sessionId - Optional session ID for session-specific routing
 * @param routingContext - Routing context with servers (optional)
 * @returns Server URL to use
 *
 * @example
 * ```ts
 * // Basic usage (routes to proxy URL)
 * const url = getClientUrl()
 * // => "/api/opencode/4056"
 *
 * // With directory (routes to directory's server if found)
 * const url = getClientUrl("/path/to/project", undefined, { servers })
 * // => "/api/opencode/4057" (if server found) or "/api/opencode/4056"
 *
 * // With session (routes to session's server)
 * const url = getClientUrl("/path/to/project", "ses_123", { servers, sessionToPort })
 * // => routes to cached session server, then directory, then proxy URL
 * ```
 */
export function getClientUrl(
	directory?: string,
	sessionId?: string,
	routingContext?: RoutingContext,
): string {
	// No routing context = use proxy URL (browser-safe)
	if (!routingContext || routingContext.servers.length === 0) {
		return DEFAULT_PROXY_URL
	}

	// Priority: session-specific routing > directory routing > default
	if (sessionId && directory) {
		return getServerForSession(
			sessionId,
			directory,
			routingContext.servers,
			routingContext.sessionToPort,
		)
	}

	if (directory) {
		return getServerForDirectory(directory, routingContext.servers)
	}

	return DEFAULT_PROXY_URL
}

/**
 * Create an OpenCode SDK client instance with smart routing
 *
 * Routes to the server that owns the session (if known),
 * otherwise falls back to directory-based routing, then default server.
 *
 * Uses multiServerSSE for routing context (server discovery + session cache).
 *
 * @param directory - Optional project directory for scoping requests
 * @param sessionId - Optional session ID for session-specific routing
 * @returns Configured OpencodeClient with all namespaces
 *
 * @example
 * ```ts
 * const client = createClient()
 * const sessions = await client.session.list()
 * ```
 */
export function createClient(directory?: string, sessionId?: string): OpencodeClient {
	// Priority: session-specific routing > directory routing > default
	let discoveredUrl: string | undefined

	if (sessionId && directory) {
		discoveredUrl = multiServerSSE.getBaseUrlForSession(sessionId, directory)
	} else if (directory) {
		discoveredUrl = multiServerSSE.getBaseUrlForDirectory(directory)
	}

	const serverUrl = discoveredUrl ?? DEFAULT_PROXY_URL

	return createOpencodeClient({
		baseUrl: serverUrl,
		directory,
	})
}

/**
 * Singleton client for global operations (no directory scoping)
 * Use createClient(directory) for project-scoped operations
 */
export const globalClient = createClient()

/**
 * SSR-specific async client factory that uses server discovery
 *
 * This function is for SERVER-SIDE RENDERING ONLY. It:
 * 1. Fetches discovered servers from /api/opencode/servers
 * 2. Routes requests through the Next.js proxy URLs (/api/opencode/${port})
 * 3. Falls back to OPENCODE_URL if discovery fails
 *
 * DO NOT use in client components - use createClient() instead.
 *
 * @param directory - Optional project directory for scoping
 * @param sessionId - Optional session ID for session-specific routing
 * @returns Promise<OpencodeClient>
 *
 * @example Server Component
 * ```tsx
 * // app/page.tsx
 * export default async function Page() {
 *   const client = await createClientSSR()
 *   const projects = await client.project.list()
 *   return <div>{projects.data.length} projects</div>
 * }
 * ```
 *
 * @example With directory routing
 * ```tsx
 * const client = await createClientSSR('/path/to/project')
 * const sessions = await client.session.list()
 * ```
 */
export async function createClientSSR(
	directory?: string,
	sessionId?: string,
): Promise<OpencodeClient> {
	// Fetch discovered servers
	const servers = await discoverServersSSR()

	// No servers found - fallback to default
	if (servers.length === 0) {
		return createOpencodeClient({
			baseUrl: OPENCODE_URL,
			directory,
		})
	}

	// Route using same logic as client-side createClient
	let serverUrl: string

	if (sessionId && directory) {
		serverUrl = getServerForSession(sessionId, directory, servers)
	} else if (directory) {
		serverUrl = getServerForDirectory(directory, servers)
	} else {
		serverUrl = servers[0]?.url ?? OPENCODE_URL
	}

	return createOpencodeClient({
		baseUrl: serverUrl,
		directory,
	})
}

/**
 * SSR-specific server discovery helper
 *
 * Fetches from /api/opencode/servers and returns ServerInfo array.
 * Returns empty array on any error (graceful degradation).
 *
 * @internal
 */
async function discoverServersSSR(): Promise<ServerInfo[]> {
	try {
		const response = await fetch("http://localhost:8423/api/opencode/servers", {
			cache: "no-store",
		})

		if (!response.ok) {
			console.warn("[createClientSSR] Discovery failed:", response.status)
			return []
		}

		const data = await response.json()

		if (!Array.isArray(data)) {
			console.warn("[createClientSSR] Invalid discovery response:", typeof data)
			return []
		}

		// Validate and transform to ServerInfo
		const servers = data
			.filter((item): item is { port: number; pid: number; directory: string } => {
				return (
					typeof item === "object" &&
					item !== null &&
					typeof item.port === "number" &&
					typeof item.directory === "string"
				)
			})
			.map((raw) => ({
				port: raw.port,
				directory: raw.directory,
				url: `http://localhost:8423/api/opencode/${raw.port}`,
			}))

		return servers
	} catch (error) {
		console.warn("[createClientSSR] Discovery error:", error)
		return []
	}
}

/**
 * Global SSR client promise for use in server components
 * Use this for global operations (no directory scoping) in SSR
 *
 * @example
 * ```tsx
 * export default async function Page() {
 *   const client = await globalClientSSR
 *   const projects = await client.project.list()
 *   return <div>...</div>
 * }
 * ```
 */
export const globalClientSSR = createClientSSR()
