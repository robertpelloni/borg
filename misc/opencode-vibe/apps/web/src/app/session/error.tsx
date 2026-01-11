"use client"

import { useEffect } from "react"
import Link from "next/link"
import { OpenCodeLogo } from "@/components/opencode-logo"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Error boundary for the session route
 *
 * Catches errors from server components and client-side SSE data rendering.
 * Prevents crashes from malformed SSE data or network errors.
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
		console.error("Session route error:", error)
	}, [error])

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
						<h1 className="text-3xl font-bold text-foreground">Session Error</h1>
						<p className="text-lg text-foreground/70">
							An error occurred while loading the session.
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
							Try Again
						</button>
						<Link
							href="/"
							className="px-6 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors text-center"
						>
							Back to Sessions
						</Link>
					</div>

					<div className="pt-4 border-t border-border">
						<details className="space-y-2">
							<summary className="text-sm font-medium text-foreground/70 cursor-pointer hover:text-foreground/90">
								Troubleshooting
							</summary>
							<div className="pt-2 text-sm text-foreground/60 space-y-2">
								<p>This error may be caused by:</p>
								<ul className="list-disc list-inside space-y-1 ml-2">
									<li>Network connection issues with the OpenCode server</li>
									<li>Malformed SSE data from real-time updates</li>
									<li>Session not found or deleted</li>
									<li>Corrupted session state</li>
								</ul>
								<p className="mt-3">
									Try refreshing the page or returning to the sessions list to start a new session.
								</p>
							</div>
						</details>
					</div>
				</div>
			</div>
		</div>
	)
}
