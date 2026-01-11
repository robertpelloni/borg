"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowDownIcon } from "lucide-react"
import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useRef,
	useState,
	useLayoutEffect,
	type ComponentProps,
	type ReactNode,
} from "react"

/**
 * Simple scroll-to-bottom context
 * Uses instant scroll for auto-scroll (streaming), smooth for manual button
 */
interface ScrollContextValue {
	scrollRef: React.RefObject<HTMLDivElement | null>
	isAtBottom: boolean
	/** Smooth scroll to bottom - for manual button clicks */
	scrollToBottom: () => void
	/** Instant scroll to bottom - for auto-scroll during streaming */
	scrollToBottomInstant: () => void
	/** Whether we're in "stick mode" - auto-scroll on new content */
	isSticking: boolean
	setIsSticking: (sticking: boolean) => void
}

const ScrollContext = createContext<ScrollContextValue | null>(null)

function useScrollContext() {
	const ctx = useContext(ScrollContext)
	if (!ctx) throw new Error("useScrollContext must be used within Conversation")
	return ctx
}

export type ConversationProps = ComponentProps<"div"> & {
	children: ReactNode
}

/**
 * Conversation container with auto-scroll behavior
 *
 * - Scrolls to bottom instantly on initial render
 * - Sticks to bottom when new content arrives (if user hasn't scrolled up)
 * - User scrolling up disables stick mode
 * - Scroll-to-bottom button re-enables stick mode
 */
export const Conversation = ({ className, children, ...props }: ConversationProps) => {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [isAtBottom, setIsAtBottom] = useState(true)
	const [isSticking, setIsSticking] = useState(true)
	const lastScrollTop = useRef(0)

	// Use ref pattern for isSticking to avoid recreating handleScroll on every change
	const isStickingRef = useRef(isSticking)
	isStickingRef.current = isSticking

	// Smooth scroll - for manual button clicks
	const scrollToBottom = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
		setIsAtBottom(true)
		setIsSticking(true)
	}, [])

	// Instant scroll - for auto-scroll during streaming
	// Using instant prevents bounce from overlapping smooth scrolls
	const scrollToBottomInstant = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		el.scrollTop = el.scrollHeight
		setIsAtBottom(true)
	}, [])

	// Handle scroll events to detect user scrolling up
	// Use ref for isSticking to avoid recreating this callback on every isSticking change
	const handleScroll = useCallback(() => {
		const el = scrollRef.current
		if (!el) return

		const { scrollTop, scrollHeight, clientHeight } = el
		const atBottom = scrollHeight - scrollTop - clientHeight < 100

		setIsAtBottom(atBottom)

		// If user scrolled UP (not down), disable sticking
		if (scrollTop < lastScrollTop.current && !atBottom) {
			setIsSticking(false)
		}

		// If user scrolled to bottom manually, re-enable sticking
		if (atBottom && !isStickingRef.current) {
			setIsSticking(true)
		}

		lastScrollTop.current = scrollTop
	}, [])

	// Initial scroll to bottom - use layoutEffect to run before paint
	// Use instant scroll to avoid animation on page load
	useLayoutEffect(() => {
		scrollToBottomInstant()
	}, [scrollToBottomInstant])

	// Auto-scroll when content changes (via ResizeObserver on content)
	// This is handled in ConversationContent

	const contextValue: ScrollContextValue = {
		scrollRef,
		isAtBottom,
		scrollToBottom,
		scrollToBottomInstant,
		isSticking,
		setIsSticking,
	}

	return (
		<ScrollContext.Provider value={contextValue}>
			<div
				ref={scrollRef}
				className={cn("relative flex-1 overflow-y-auto overflow-x-hidden", className)}
				onScroll={handleScroll}
				role="log"
				{...props}
			>
				{children}
			</div>
		</ScrollContext.Provider>
	)
}

export type ConversationContentProps = ComponentProps<"div">

/**
 * Content wrapper that triggers auto-scroll when content size changes
 */
export const ConversationContent = ({
	className,
	children,
	...props
}: ConversationContentProps) => {
	const { isSticking, scrollToBottomInstant } = useScrollContext()
	const contentRef = useRef<HTMLDivElement>(null)

	// Use ref to avoid recreating ResizeObserver on isSticking change
	const isStickingRef = useRef(isSticking)
	isStickingRef.current = isSticking

	// Watch for content size changes and auto-scroll if sticking
	// Uses INSTANT scroll to prevent bounce from overlapping smooth scrolls
	useEffect(() => {
		const content = contentRef.current
		if (!content) return

		const observer = new ResizeObserver(() => {
			if (isStickingRef.current) {
				// Use requestAnimationFrame to batch with render
				requestAnimationFrame(() => {
					scrollToBottomInstant()
				})
			}
		})

		observer.observe(content)
		return () => observer.disconnect()
	}, [scrollToBottomInstant])

	return (
		<div
			ref={contentRef}
			className={cn("flex flex-col gap-6 px-4 py-6 w-full max-w-4xl mx-auto", className)}
			{...props}
		>
			{children}
		</div>
	)
}

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
	title?: string
	description?: string
	icon?: React.ReactNode
}

export const ConversationEmptyState = ({
	className,
	title = "No messages yet",
	description = "Start a conversation to see messages here",
	icon,
	children,
	...props
}: ConversationEmptyStateProps) => (
	<div
		className={cn(
			"flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
			className,
		)}
		{...props}
	>
		{children ?? (
			<>
				{icon && <div className="text-muted-foreground">{icon}</div>}
				<div className="space-y-1">
					<h3 className="font-medium text-sm">{title}</h3>
					{description && <p className="text-muted-foreground text-sm">{description}</p>}
				</div>
			</>
		)}
	</div>
)

export type ConversationScrollButtonProps = ComponentProps<typeof Button>

export const ConversationScrollButton = ({
	className,
	...props
}: ConversationScrollButtonProps) => {
	const { isAtBottom, scrollToBottom } = useScrollContext()

	return (
		!isAtBottom && (
			<Button
				className={cn("fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full z-10", className)}
				onClick={scrollToBottom}
				size="icon"
				type="button"
				variant="outline"
				{...props}
			>
				<ArrowDownIcon className="size-4" />
			</Button>
		)
	)
}
