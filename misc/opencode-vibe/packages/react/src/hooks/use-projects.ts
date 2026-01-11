/**
 * useProjects - Bridge Promise API to React state
 *
 * Wraps projects.list and projects.current from @opencode-vibe/core/api.
 * Provides two separate hooks for list and current project.
 *
 * @example
 * ```tsx
 * function ProjectList() {
 *   const { projects, loading, error, refetch } = useProjects()
 *
 *   if (loading) return <div>Loading projects...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {projects.map(p => <li key={p.worktree}>{p.name || p.worktree}</li>)}
 *     </ul>
 *   )
 * }
 *
 * function CurrentProject() {
 *   const { project, loading, error } = useCurrentProject()
 *
 *   if (loading) return <div>Loading...</div>
 *   if (!project) return <div>No project selected</div>
 *
 *   return <div>Current: {project.name || project.worktree}</div>
 * }
 * ```
 */

"use client"

import { useState, useEffect } from "react"
import { projects } from "@opencode-vibe/core/api"
import type { Project } from "@opencode-vibe/core/atoms"

export interface UseProjectsReturn {
	/** Array of projects */
	projects: Project[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch projects */
	refetch: () => void
}

export interface UseCurrentProjectReturn {
	/** Current project or null */
	project: Project | null
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch current project */
	refetch: () => void
}

/**
 * Hook to fetch project list using Promise API from core
 *
 * @returns Object with projects, loading, error, and refetch
 */
export function useProjects(): UseProjectsReturn {
	const [data, setData] = useState<Project[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [refreshKey, setRefreshKey] = useState(0)

	useEffect(() => {
		let cancelled = false

		async function fetchProjects() {
			try {
				setLoading(true)
				const result = await projects.list()
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

		fetchProjects()

		return () => {
			cancelled = true
		}
	}, [refreshKey])

	const refetch = () => setRefreshKey((k) => k + 1)

	return {
		projects: data,
		loading,
		error,
		refetch,
	}
}

/**
 * Hook to fetch current project using Promise API from core
 *
 * @returns Object with project, loading, error, and refetch
 */
export function useCurrentProject(): UseCurrentProjectReturn {
	const [data, setData] = useState<Project | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)
	const [refreshKey, setRefreshKey] = useState(0)

	useEffect(() => {
		let cancelled = false

		async function fetchCurrentProject() {
			try {
				setLoading(true)
				const result = await projects.current()
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

		fetchCurrentProject()

		return () => {
			cancelled = true
		}
	}, [refreshKey])

	const refetch = () => setRefreshKey((k) => k + 1)

	return {
		project: data,
		loading,
		error,
		refetch,
	}
}

// Re-export type for convenience
export type { Project }
