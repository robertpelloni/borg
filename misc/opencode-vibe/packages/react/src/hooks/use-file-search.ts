/**
 * useFileSearch - React hook for debounced file search with fuzzy filtering
 *
 * Provides:
 * - Debounced API calls to SDK find.files endpoint
 * - Fuzzy filtering with fuzzysort for relevance ranking
 * - Loading and error states
 * - Top 10 results limit
 *
 * @param query - Search query string
 * @param options - Optional configuration { debounceMs?: number }
 * @returns { files: string[], isLoading: boolean, error: Error | null }
 *
 * @example
 * ```tsx
 * const { files, isLoading, error } = useFileSearch(searchQuery)
 *
 * if (isLoading) return <Spinner />
 * if (error) return <ErrorMessage error={error} />
 *
 * return (
 *   <ul>
 *     {files.map(path => <li key={path}>{path}</li>)}
 *   </ul>
 * )
 * ```
 */

import { useState, useEffect, useRef } from "react"
import { useOpencode } from "../providers"
import { createClient } from "../lib/client-stub"
import fuzzysort from "fuzzysort"

export interface UseFileSearchOptions {
	/** Debounce delay in milliseconds (default: 150ms) */
	debounceMs?: number
}

export interface UseFileSearchResult {
	/** Filtered and sorted file paths (max 10) */
	files: string[]
	/** Whether API request is in flight */
	isLoading: boolean
	/** Error from SDK call, if any */
	error: Error | null
}

/**
 * Hook for debounced file search with fuzzy filtering
 */
export function useFileSearch(
	query: string,
	options: UseFileSearchOptions = {},
): UseFileSearchResult {
	const { debounceMs = 150 } = options
	const { directory } = useOpencode()

	const [files, setFiles] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	// Track debounce timeout
	const timeoutRef = useRef<Timer | null>(null)

	useEffect(() => {
		// Clear results for empty query
		if (!query) {
			setFiles([])
			setIsLoading(false)
			setError(null)
			return
		}

		// Cancel previous timeout
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
		}

		// Set loading state immediately for UX feedback
		setIsLoading(true)
		setError(null)

		// Debounce the API call
		timeoutRef.current = setTimeout(async () => {
			try {
				// Create client with directory scoping (now async)
				const client = await createClient(directory)

				// Call SDK to get all matching files
				// Note: SDK expects dirs as string "true"/"false", not boolean
				const response = await client.find.files({
					query: { query, dirs: "true" },
				})

				// Extract file paths from response
				const allFiles = response.data ?? []

				// Apply fuzzy filtering with fuzzysort
				const fuzzyResults = fuzzysort.go(query, allFiles, {
					limit: 10,
					threshold: -10000, // Allow fuzzy matches
				})

				// Extract file paths from results
				const filteredFiles = fuzzyResults.map((r) => r.target)

				setFiles(filteredFiles)
				setIsLoading(false)
			} catch (err) {
				console.error("[useFileSearch] Error fetching files:", err)
				setError(err instanceof Error ? err : new Error(String(err)))
				setFiles([])
				setIsLoading(false)
			}
		}, debounceMs)

		// Cleanup on unmount or query change
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [query, directory, debounceMs])

	return { files, isLoading, error }
}
