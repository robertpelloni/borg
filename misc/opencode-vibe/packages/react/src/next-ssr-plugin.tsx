/**
 * OpencodeSSRPlugin - Inject OpenCode configuration before React hydrates
 *
 * Pattern: uploadthing's useServerInsertedHTML approach
 *
 * Usage:
 * ```tsx
 * // app/layout.tsx or page component
 * <OpencodeSSRPlugin config={{ baseUrl: "/api/opencode/4056", directory: "/path" }} />
 * ```
 */
"use client"

import { useServerInsertedHTML } from "next/navigation"

export interface OpencodeConfig {
	baseUrl: string
	directory: string
}

export interface OpencodeSSRPluginProps {
	config: OpencodeConfig
}

/**
 * Injects OpenCode configuration into globalThis before React hydration
 *
 * This eliminates the need for a React provider wrapper by making config
 * available synchronously during client-side rendering.
 *
 * Works in two ways:
 * 1. SSR: useServerInsertedHTML injects a script tag during server rendering
 * 2. Client: Synchronously sets window.__OPENCODE during render (before hooks run)
 */
export function OpencodeSSRPlugin({ config }: OpencodeSSRPluginProps) {
	// SSR: Inject script tag during server rendering
	useServerInsertedHTML(() => {
		return (
			<script
				dangerouslySetInnerHTML={{
					__html: `window.__OPENCODE = ${JSON.stringify(config)};`,
				}}
			/>
		)
	})

	// Client: Set config synchronously during render (not in useEffect!)
	// This ensures config is available before any hooks call getOpencodeConfig()
	if (typeof window !== "undefined") {
		window.__OPENCODE = config
	}

	return null
}
