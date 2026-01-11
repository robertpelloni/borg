"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect } from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { multiServerSSE } from "@opencode-vibe/core/sse"

interface LayoutClientProps {
	children: ReactNode
}

/**
 * Client-side layout wrapper
 *
 * Includes:
 * - ThemeProvider for dark mode
 * - Toaster for notifications
 * - Global SSE initialization (multiServerSSE.start)
 *
 * Note: OpencodeSSRPlugin is rendered at the page level (session/[id]/page.tsx)
 * where we have access to the directory from URL search params.
 */
export function LayoutClient({ children }: LayoutClientProps) {
	// Start multiServerSSE globally (idempotent, safe to call multiple times)
	// This ensures discovery happens on all pages, not just session pages
	// NOTE: No cleanup function - LayoutClient never unmounts (root layout)
	useEffect(() => {
		console.log("[LayoutClient] Starting multiServerSSE")
		multiServerSSE.start()
	}, [])

	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<Suspense
				fallback={
					<div className="h-dvh flex items-center justify-center">
						<div className="text-muted-foreground">Loading...</div>
					</div>
				}
			>
				{children}
			</Suspense>
			<Toaster
				position="top-right"
				richColors
				closeButton
				toastOptions={{
					classNames: {
						toast: "font-sans",
					},
				}}
			/>
		</ThemeProvider>
	)
}
