/**
 * useProviders - Bridge Promise API to React state
 *
 * Wraps providers.list from @opencode-vibe/core/api and manages React state.
 * Provides loading, error, and data states for provider list.
 *
 * @example
 * ```tsx
 * function ProviderList() {
 *   const { providers, loading, error, refetch } = useProviders()
 *
 *   if (loading) return <div>Loading providers...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <select>
 *       {providers.map(provider =>
 *         provider.models.map(model => (
 *           <option key={`${provider.id}-${model.id}`}>
 *             {provider.name} - {model.name}
 *           </option>
 *         ))
 *       )}
 *     </select>
 *   )
 * }
 * ```
 */

"use client"

import { useState, useEffect } from "react"
import { providers } from "@opencode-vibe/core/api"
import type { Provider, Model } from "@opencode-vibe/core/atoms"

export interface UseProvidersReturn {
	/** Array of providers with their models */
	providers: Provider[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch providers */
	refetch: () => void
}

/**
 * Hook to fetch provider list using Promise API from core
 *
 * @returns Object with providers, loading, error, and refetch
 */
export function useProviders(): UseProvidersReturn {
	const [data, setData] = useState<Provider[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [refreshKey, setRefreshKey] = useState(0)

	useEffect(() => {
		let cancelled = false

		async function fetchProviders() {
			try {
				setLoading(true)
				const result = await providers.list()
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

		fetchProviders()

		return () => {
			cancelled = true
		}
	}, [refreshKey])

	const refetch = () => setRefreshKey((k) => k + 1)

	return {
		providers: data,
		loading,
		error,
		refetch,
	}
}

// Re-export types for convenience
export type { Provider, Model }
