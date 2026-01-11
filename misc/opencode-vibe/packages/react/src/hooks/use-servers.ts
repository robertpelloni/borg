/**
 * useServers - Bridge Promise API to React state
 *
 * Wraps servers.discover and servers.currentServer from @opencode-vibe/core/api.
 * Provides hooks for server discovery and current server selection.
 *
 * @example
 * ```tsx
 * function ServerList() {
 *   const { servers, loading, error, refetch } = useServers()
 *
 *   if (loading) return <div>Discovering servers...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {servers.map(s => (
 *         <li key={`${s.port}-${s.directory}`}>
 *           {s.url} - {s.directory || '(no directory)'}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 *
 * function CurrentServer() {
 *   const { server, loading, error } = useCurrentServer()
 *
 *   if (loading) return <div>Loading...</div>
 *   if (!server) return <div>No server found</div>
 *
 *   return <div>Connected: {server.url}</div>
 * }
 * ```
 */

"use client"

import { useState, useEffect } from "react"
import { servers } from "@opencode-vibe/core/api"
import type { ServerInfo } from "@opencode-vibe/core/discovery"

export interface UseServersReturn {
	/** Array of discovered servers (always includes default) */
	servers: ServerInfo[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed (should never happen, falls back to default) */
	error: Error | null
	/** Refetch servers */
	refetch: () => void
}

export interface UseCurrentServerReturn {
	/** Current best server (never null, falls back to default) */
	server: ServerInfo | null
	/** Loading state */
	loading: boolean
	/** Error if fetch failed (should never happen) */
	error: Error | null
	/** Refetch current server */
	refetch: () => void
}

/**
 * Hook to discover OpenCode servers using Promise API from core
 *
 * Note: servers.discover() never fails - it falls back to localhost:4056
 *
 * @returns Object with servers, loading, error, and refetch
 */
export function useServers(): UseServersReturn {
	const [data, setData] = useState<ServerInfo[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [refreshKey, setRefreshKey] = useState(0)

	useEffect(() => {
		let cancelled = false

		async function fetchServers() {
			try {
				setLoading(true)
				const result = await servers.discover()
				if (!cancelled) {
					setData(result)
					setError(null)
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err : new Error(String(err)))
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		fetchServers()

		return () => {
			cancelled = true
		}
	}, [refreshKey])

	const refetch = () => setRefreshKey((k) => k + 1)

	return {
		servers: data,
		loading,
		error,
		refetch,
	}
}

/**
 * Hook to get current best server using Promise API from core
 *
 * Uses heuristic:
 * 1. First server with non-empty directory
 * 2. Otherwise, first server in list
 * 3. Falls back to localhost:4056
 *
 * @returns Object with server, loading, error, and refetch
 */
export function useCurrentServer(): UseCurrentServerReturn {
	const [data, setData] = useState<ServerInfo | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [refreshKey, setRefreshKey] = useState(0)

	useEffect(() => {
		let cancelled = false

		async function fetchCurrentServer() {
			try {
				setLoading(true)
				const result = await servers.currentServer()
				if (!cancelled) {
					setData(result)
					setError(null)
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err : new Error(String(err)))
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		fetchCurrentServer()

		return () => {
			cancelled = true
		}
	}, [refreshKey])

	const refetch = () => setRefreshKey((k) => k + 1)

	return {
		server: data,
		loading,
		error,
		refetch,
	}
}

// Re-export type for convenience
export type { ServerInfo }

// Alias for backwards compatibility
export { useServers as useServersEffect }
