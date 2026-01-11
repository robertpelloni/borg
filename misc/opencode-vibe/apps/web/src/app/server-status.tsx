"use client"

/**
 * Server Status Display Component
 *
 * Client component that shows discovered OpenCode servers.
 * Uses Effect-based discovery hooks from @opencode-vibe/react.
 */

import { OpencodeSSRPlugin } from "@opencode-vibe/react"
import { useServersEffect } from "@/app/hooks"

export function ServerStatus() {
	const { servers, loading, error } = useServersEffect()

	return (
		<>
			{/* Inject OpenCode config for factory hooks */}
			<OpencodeSSRPlugin
				config={{
					baseUrl: "/api/opencode",
					directory: "", // No specific directory for global operations
				}}
			/>
			{loading ? (
				<div className="text-xs text-muted-foreground">Discovering servers...</div>
			) : error ? (
				<div className="text-xs text-destructive">Server discovery error</div>
			) : (
				<div className="text-xs text-muted-foreground">
					{servers.length} server{servers.length !== 1 ? "s" : ""} available
				</div>
			)}
		</>
	)
}
