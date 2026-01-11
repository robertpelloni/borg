"use client"

import { useEffect } from "react"
import Link from "next/link"
import { OpenCodeLogo } from "@/components/opencode-logo"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Error boundary for individual session pages
 *
 * Catches errors during session rendering, including:
 * - SSE data parsing errors
 * - Message rendering failures
 * - Real-time update crashes
 * - Malformed message parts (tools, reasoning, etc.)
 *
 * This is the innermost error boundary for session-specific crashes.
 */
export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		// Log to console in development
		console.error("Session page error:", error)
	}, [error])

	// Check if this is a SSE-related error
	const isSSEError =
		error.message.includes("SSE") ||
		error.message.includes("EventSource") ||
		error.message.includes("streaming")

	// Check if this is a message rendering error
	const isRenderError =
		error.message.includes("Cannot read") ||
		error.message.includes("undefined") ||
		error.message.includes("null")

	return (
		<div className="min-h-screen bg-background flex flex-col">
			{/* Header */}
			<header className="shrink-0 z-10 backdrop-blur-sm bg-background/80 border-b border-border/50">
				<div className="max-w-4xl mx-auto px-4 py-3">
					<div className="flex items-center justify-between">
						<Link
							href="/"
							className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
						>
							<OpenCodeLogo width={100} height={18} className="text-foreground" />
							<span className="text-foreground/60 text-xs font-medium">|</span>
							<span className="text-foreground font-semibold text-sm tracking-wide">VIBE</span>
						</Link>
						<ThemeToggle />
					</div>
				</div>
			</header>

			{/* Error content */}
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="max-w-2xl w-full space-y-6">
					<div className="space-y-2">
						<h1 className="text-3xl font-bold text-foreground">
							{isSSEError ? "Real-time Update Error" : "Message Rendering Error"}
						</h1>
						<p className="text-lg text-foreground/70">
							{isSSEError
								? "An error occurred while receiving real-time updates."
								: "An error occurred while rendering messages."}
						</p>
					</div>

					<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 space-y-2">
						<h2 className="text-sm font-semibold text-destructive">Error Details:</h2>
						<p className="text-sm text-foreground/80 font-mono break-words">{error.message}</p>
						{error.digest && <p className="text-xs text-foreground/60">Digest: {error.digest}</p>}
					</div>

					<div className="flex flex-col sm:flex-row gap-3">
						<button
							type="button"
							onClick={() => reset()}
							className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
						>
							Retry
						</button>
						<Link
							href="/"
							className="px-6 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors text-center"
						>
							Back to Sessions
						</Link>
					</div>

					{isRenderError && (
						<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 space-y-2">
							<h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
								Likely Cause
							</h3>
							<p className="text-sm text-foreground/70">
								This error typically occurs when message data is malformed or missing required
								fields. The real-time update stream may have sent incomplete data.
							</p>
						</div>
					)}

					{isSSEError && (
						<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 space-y-2">
							<h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
								Likely Cause
							</h3>
							<p className="text-sm text-foreground/70">
								The real-time connection to the OpenCode server may have been interrupted or sent
								invalid data. Check that the server is still running.
							</p>
						</div>
					)}

					<div className="pt-4 border-t border-border">
						<details className="space-y-2">
							<summary className="text-sm font-medium text-foreground/70 cursor-pointer hover:text-foreground/90">
								Troubleshooting Steps
							</summary>
							<div className="pt-2 text-sm text-foreground/60 space-y-2">
								<ol className="list-decimal list-inside space-y-2 ml-2">
									<li>Click "Retry" to reload the session</li>
									<li>Check the OpenCode server is running and accessible</li>
									<li>Verify network connectivity</li>
									<li>Try opening the session in a new tab</li>
									<li>
										If the error persists, the session data may be corrupted - try creating a new
										session
									</li>
								</ol>
							</div>
						</details>
					</div>
				</div>
			</div>
		</div>
	)
}
