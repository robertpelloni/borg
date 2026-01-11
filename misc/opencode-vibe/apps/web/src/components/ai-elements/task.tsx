"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, SearchIcon } from "lucide-react"
import React, { type ComponentProps } from "react"
import type { ToolPart } from "@opencode-ai/sdk/client"

// Type definitions from SUBAGENT_DISPLAY.md Section 6
interface TaskToolMetadata {
	sessionId: string
	summary: Array<{
		id: string
		tool: string
		state: {
			status: "pending" | "running" | "completed" | "error"
			title?: string
		}
	}>
}

export interface CurrentActivity {
	type: "running" | "completed"
	tool: string
	title?: string
}

/**
 * Extracts the current activity from a Task tool part.
 *
 * Priority:
 * 1. Last running tool (status: "running")
 * 2. Last completed tool (status: "completed")
 * 3. null if no tools executed yet
 *
 * @param part - ToolPart from OpenCode SDK
 * @returns CurrentActivity or null if not applicable
 */
export function getCurrentlyDoing(part: ToolPart): CurrentActivity | null {
	if (part.type !== "tool") return null
	if (part.tool !== "task") return null
	if (part.state.status === "pending") return null

	// Get metadata which contains summary array
	const metadata = part.state.metadata as TaskToolMetadata | undefined

	if (!metadata?.summary || metadata.summary.length === 0) return null

	// Find the last running tool
	const running = metadata.summary.filter((item) => item.state.status === "running").at(-1)

	if (running) {
		return {
			type: "running",
			tool: running.tool,
			// No title yet - still in progress
		}
	}

	// Fallback to last completed tool
	const lastCompleted = metadata.summary.filter((item) => item.state.status === "completed").at(-1)

	if (lastCompleted) {
		return {
			type: "completed",
			tool: lastCompleted.tool,
			title: lastCompleted.state.title,
		}
	}

	return null
}

export type TaskItemFileProps = ComponentProps<"div">

export const TaskItemFile = ({ children, className, ...props }: TaskItemFileProps) => (
	<div
		className={cn(
			"inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-foreground text-xs",
			className,
		)}
		{...props}
	>
		{children}
	</div>
)

export type TaskItemProps = ComponentProps<"div">

export const TaskItem = ({ children, className, ...props }: TaskItemProps) => (
	<div className={cn("text-muted-foreground text-sm", className)} {...props}>
		{children}
	</div>
)

export type TaskProps = ComponentProps<typeof Collapsible>

export const Task = ({ defaultOpen = true, className, ...props }: TaskProps) => (
	<Collapsible className={cn(className)} defaultOpen={defaultOpen} {...props} />
)

export type TaskTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
	title: string
}

export const TaskTrigger = ({ children, className, title, ...props }: TaskTriggerProps) => (
	<CollapsibleTrigger asChild className={cn("group", className)} {...props}>
		{children ?? (
			<div className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
				<SearchIcon className="size-4" />
				<p className="text-sm">{title}</p>
				<ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
			</div>
		)}
	</CollapsibleTrigger>
)

export type TaskContentProps = ComponentProps<typeof CollapsibleContent>

export const TaskContent = ({ children, className, ...props }: TaskContentProps) => (
	<CollapsibleContent
		className={cn(
			"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
			className,
		)}
		{...props}
	>
		<div className="mt-4 space-y-2 border-muted border-l-2 pl-4">{children}</div>
	</CollapsibleContent>
)

/**
 * Maps tool names to friendly action verbs
 * Used for displaying "Reading file...", "Searching...", etc.
 */
function formatToolName(tool: string): string {
	const names: Record<string, string> = {
		read: "Reading file",
		grep: "Searching",
		glob: "Finding files",
		edit: "Editing",
		write: "Writing",
		bash: "Running command",
		task: "Subagent",
	}
	return names[tool] || tool
}

export type SubagentCurrentActivityProps = {
	part: ToolPart
	className?: string
}

/**
 * Displays what a subagent is currently doing in real-time.
 *
 * Shows:
 * - Running: Tool icon + action verb (e.g., "🔍 Searching...")
 * - Completed: Last completed tool title
 * - Initializing: "Starting..." when no summary yet
 *
 * Data source: part.state.metadata.summary (updates via SSE)
 */
const SubagentCurrentActivityInternal = ({ part, className }: SubagentCurrentActivityProps) => {
	const activity = getCurrentlyDoing(part)

	if (!activity) {
		// Still initializing - task is running but no tools executed yet
		if (part.type === "tool" && part.tool === "task" && part.state.status === "running") {
			return (
				<div className={cn("flex items-center gap-1.5 text-muted-foreground text-xs", className)}>
					<span className="italic">Starting...</span>
				</div>
			)
		}
		return null
	}

	if (activity.type === "running") {
		return (
			<div className={cn("flex items-center gap-1.5 text-primary text-xs", className)}>
				<SearchIcon className="size-3 animate-pulse" />
				<span>{formatToolName(activity.tool)}...</span>
			</div>
		)
	}

	// Completed - show the title
	return (
		<div className={cn("flex items-center gap-1.5 text-muted-foreground text-xs", className)}>
			<span>{activity.title || activity.tool}</span>
		</div>
	)
}

/**
 * Memoized version with content-aware comparison.
 *
 * Problem: Immer creates new object references on every store update,
 * breaking React.memo shallow comparison even when content is identical.
 *
 * Solution: Deep compare summary array content (id, status, tool) instead
 * of reference equality.
 */
export const SubagentCurrentActivity = React.memo(
	SubagentCurrentActivityInternal,
	(prevProps, nextProps) => {
		// Fast path: Compare IDs first
		if (prevProps.part.id !== nextProps.part.id) return false

		// Fast path: Compare status
		if (prevProps.part.state.status !== nextProps.part.state.status) return false

		// Extract metadata (safe for non-pending states)
		const prevMetadata =
			prevProps.part.state.status !== "pending"
				? (prevProps.part.state.metadata as TaskToolMetadata | undefined)
				: undefined
		const nextMetadata =
			nextProps.part.state.status !== "pending"
				? (nextProps.part.state.metadata as TaskToolMetadata | undefined)
				: undefined

		// Deep compare summary content (Immer-safe)
		const prevSummary = prevMetadata?.summary
		const nextSummary = nextMetadata?.summary

		// Both undefined/null - equal
		if (!prevSummary && !nextSummary) return true

		// One undefined, one defined - not equal
		if (!prevSummary || !nextSummary) return false

		// Different lengths - not equal
		if (prevSummary.length !== nextSummary.length) return false

		// Compare each item's content (id, status, tool, title)
		return prevSummary.every((item, i) => {
			const nextItem = nextSummary[i]
			return (
				nextItem &&
				item.id === nextItem.id &&
				item.state.status === nextItem.state.status &&
				item.tool === nextItem.tool &&
				item.state.title === nextItem.state.title
			)
		})
	},
)

/**
 * Maps tool status to Unicode icon.
 * ✓ = completed
 * ⏳ = running
 * ✗ = error
 * ◯ = pending
 */
function getStatusIcon(status: "pending" | "running" | "completed" | "error"): string {
	const icons: Record<string, string> = {
		completed: "✓",
		running: "⏳",
		error: "✗",
		pending: "◯",
	}
	return icons[status] || "◯"
}

export type SubagentToolTreeProps = {
	part: ToolPart
	className?: string
	defaultOpen?: boolean
}

/**
 * Displays full tree of all tools executed by a subagent.
 *
 * Shows:
 * - Full metadata.summary array as collapsible tree
 * - Status icons: ✓ completed, ⏳ running, ✗ error, ◯ pending
 * - Tool titles when completed
 * - Tree structure with branch characters (├ └)
 *
 * Default collapsed. Click to expand/collapse.
 */
const SubagentToolTreeInternal = ({
	part,
	className,
	defaultOpen = false,
}: SubagentToolTreeProps) => {
	const [isOpen, setIsOpen] = React.useState(defaultOpen)

	if (part.type !== "tool" || part.tool !== "task") return null
	if (part.state.status === "pending") return null

	const metadata = part.state.metadata as TaskToolMetadata | undefined
	const summary = metadata?.summary

	if (!summary || summary.length === 0) return null

	return (
		<div className={cn("mt-2", className)}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="group flex w-full items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
			>
				<ChevronDownIcon className={cn("size-3 transition-transform", !isOpen && "-rotate-90")} />
				<span>Tools ({summary.length})</span>
			</button>

			{isOpen && (
				<div className="mt-1">
					<div className="space-y-0.5">
						{summary.map((item, index) => {
							const isLast = index === summary.length - 1
							const branch = isLast ? "└" : "├"
							const icon = getStatusIcon(item.state.status)

							return (
								<div key={item.id} className="flex items-start gap-1.5 font-mono text-xs">
									<span className="text-muted-foreground">{branch}</span>
									<span
										className={cn("flex-shrink-0", {
											"text-green-600": item.state.status === "completed",
											"text-blue-600 animate-pulse": item.state.status === "running",
											"text-red-600": item.state.status === "error",
											"text-muted-foreground": item.state.status === "pending",
										})}
									>
										{icon}
									</span>
									<span className="flex-1 text-foreground">{item.state.title || item.tool}</span>
								</div>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * Memoized with same content-aware comparison as SubagentCurrentActivity.
 */
export const SubagentToolTree = React.memo(SubagentToolTreeInternal, (prevProps, nextProps) => {
	// Fast path: Compare IDs first
	if (prevProps.part.id !== nextProps.part.id) return false

	// Fast path: Compare status
	if (prevProps.part.state.status !== nextProps.part.state.status) return false

	// Extract metadata (safe for non-pending states)
	const prevMetadata =
		prevProps.part.state.status !== "pending"
			? (prevProps.part.state.metadata as TaskToolMetadata | undefined)
			: undefined
	const nextMetadata =
		nextProps.part.state.status !== "pending"
			? (nextProps.part.state.metadata as TaskToolMetadata | undefined)
			: undefined

	// Deep compare summary content (Immer-safe)
	const prevSummary = prevMetadata?.summary
	const nextSummary = nextMetadata?.summary

	// Both undefined/null - equal
	if (!prevSummary && !nextSummary) return true

	// One undefined, one defined - not equal
	if (!prevSummary || !nextSummary) return false

	// Different lengths - not equal
	if (prevSummary.length !== nextSummary.length) return false

	// Compare each item's content (id, status, tool, title)
	return prevSummary.every((item, i) => {
		const nextItem = nextSummary[i]
		return (
			nextItem &&
			item.id === nextItem.id &&
			item.state.status === nextItem.state.status &&
			item.tool === nextItem.tool &&
			item.state.title === nextItem.state.title
		)
	})
})
