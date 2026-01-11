/**
 * Project Management Atoms
 *
 * Pure Effect programs for project list and current project fetching.
 * Framework-agnostic - no React dependencies.
 *
 * Provides:
 * - Project list fetching as Effect program
 * - Current project fetching as Effect program
 * - Type-safe error handling
 *
 * @module atoms/projects
 */

import { Effect } from "effect"
import { createClient } from "../client/index.js"

/**
 * Project information from the SDK
 * This matches the shape returned by client.project.list() and client.project.current()
 */
export interface Project {
	/** Project worktree path */
	worktree: string
	/** Project name (derived from path) */
	name?: string
}

/**
 * Project atom namespace
 *
 * Pure Effect programs for project operations.
 * Use with Effect.runPromise in React hooks.
 */
export const ProjectAtom = {
	/**
	 * Fetch all projects
	 *
	 * @returns Effect program yielding Project array
	 *
	 * @example
	 * ```typescript
	 * // In React hook:
	 * Effect.runPromise(ProjectAtom.list())
	 *   .then(projects => setState({ projects, loading: false }))
	 *   .catch(error => setState({ error, loading: false }))
	 * ```
	 */
	list: (): Effect.Effect<Project[], Error> =>
		Effect.gen(function* () {
			const client = yield* Effect.sync(() => createClient())

			const result = yield* Effect.tryPromise({
				try: (_signal) => client.project.list(),
				catch: (e) => new Error(`Failed to fetch projects: ${e}`),
			})

			// SDK returns { data: [...] } structure
			return result.data ?? []
		}),

	/**
	 * Get the current project
	 *
	 * @returns Effect program yielding Project or null
	 *
	 * @example
	 * ```typescript
	 * // In React hook:
	 * Effect.runPromise(ProjectAtom.current())
	 *   .then(project => setState({ project, loading: false }))
	 *   .catch(error => setState({ error, loading: false }))
	 * ```
	 */
	current: (): Effect.Effect<Project | null, Error> =>
		Effect.gen(function* () {
			const client = yield* Effect.sync(() => createClient())

			const result = yield* Effect.tryPromise({
				try: (_signal) => client.project.current(),
				catch: (e) => new Error(`Failed to fetch current project: ${e}`),
			})

			// SDK returns { data: {...} } structure
			return result.data ?? null
		}),
}
