/**
 * SessionStatus - Visual indicator showing when AI is generating a response
 *
 * Shows "Running" when session.status.running === true, "Idle" otherwise.
 * Uses useSessionStatus hook to subscribe to store (synced via SSE).
 *
 * @example
 * ```tsx
 * <SessionStatus sessionId="abc-123" />
 * ```
 */

"use client"

import { useSessionStatus } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"

export interface SessionStatusProps {
	sessionId: string
	directory?: string
}

/**
 * SessionStatus component - displays running/idle indicator
 * No error state - errors are handled by store
 */
export function SessionStatus({ sessionId }: SessionStatusProps) {
	const status = useSessionStatus(sessionId)
	const running = status === "running"

	return <Badge variant={running ? "default" : "secondary"}>{running ? "Running" : "Idle"}</Badge>
}
