/**
 * useCreateSession - Create a new OpenCode session
 *
 * Provides a function to create sessions with optional title and handles loading/error states.
 *
 * Usage:
 * ```tsx
 * function NewSessionButton() {
 *   const { createSession, isCreating, error } = useCreateSession()
 *
 *   const handleCreate = async () => {
 *     const session = await createSession("My new session")
 *     if (session) {
 *       router.push(`/session/${session.id}`)
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleCreate} disabled={isCreating}>
 *       {isCreating ? "Creating..." : "New Session"}
 *     </button>
 *   )
 * }
 * ```
 */

import { useCallback, useState } from "react"
import { sessions, type Session } from "@opencode-vibe/core/api"

interface UseCreateSessionReturn {
	createSession: (title?: string) => Promise<Session | null>
	isCreating: boolean
	error: Error | null
}

/**
 * Create a new session with optional title
 *
 * Uses sessions.create() from @opencode-vibe/core/api for Promise-based session creation.
 * Returns unwrapped Session (no .data access needed).
 *
 * @returns Function to create session, loading state, and error state
 *
 * @example Basic usage
 * ```tsx
 * function NewSessionButton() {
 *   const { createSession, isCreating, error } = useCreateSession()
 *
 *   const handleCreate = async () => {
 *     const session = await createSession()
 *     if (session) {
 *       console.log("Created:", session.id)
 *     }
 *   }
 *
 *   return <button onClick={handleCreate}>New Session</button>
 * }
 * ```
 *
 * @example With title
 * ```tsx
 * function NewSessionForm() {
 *   const [title, setTitle] = useState("")
 *   const { createSession, isCreating, error } = useCreateSession()
 *
 *   const handleSubmit = async (e: FormEvent) => {
 *     e.preventDefault()
 *     const session = await createSession(title)
 *     if (session) {
 *       router.push(`/session/${session.id}`)
 *     }
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={title} onChange={e => setTitle(e.target.value)} />
 *       <button type="submit" disabled={isCreating}>Create</button>
 *       {error && <p>Error: {error.message}</p>}
 *     </form>
 *   )
 * }
 * ```
 */
export function useCreateSession(): UseCreateSessionReturn {
	const [isCreating, setIsCreating] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const createSession = useCallback(async (title?: string): Promise<Session | null> => {
		try {
			setIsCreating(true)
			setError(null)

			// Call sessions.create() from @opencode-vibe/core/api
			// Returns: Session (already unwrapped, no .data access needed)
			const result = await sessions.create(title)

			return result
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			return null
		} finally {
			setIsCreating(false)
		}
	}, [])

	return { createSession, isCreating, error }
}
