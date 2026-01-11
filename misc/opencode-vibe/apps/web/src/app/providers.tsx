"use client"

/**
 * DEPRECATED: OpenCode-specific providers moved to layout.tsx via OpencodeSSRPlugin
 *
 * This file now only exists for backward compatibility.
 * The app uses OpencodeSSRPlugin + factory hooks instead of context providers.
 *
 * Migration path:
 * - Old: <Providers><App /></Providers>
 * - New: <OpencodeSSRPlugin config={{...}} /> in layout.tsx + factory hooks from @/app/hooks
 *
 * See: docs/adr/013-unified-same-origin-architecture.md
 */

import type { ReactNode } from "react"
import { useEffect } from "react"

interface ProvidersProps {
	children: ReactNode
}

/**
 * Deprecated providers wrapper
 *
 * @deprecated Use OpencodeSSRPlugin in layout.tsx instead
 */
export function Providers({ children }: ProvidersProps) {
	useEffect(() => {
		console.warn(
			"[OpenCode] Providers component is deprecated and will be removed in v2.0.0.\n" +
				"The app now uses OpencodeSSRPlugin + factory hooks pattern.\n" +
				"See docs/adr/013-unified-same-origin-architecture.md for migration guide.",
		)
	}, [])

	return <>{children}</>
}
