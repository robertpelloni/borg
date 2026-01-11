/**
 * Output formatting utilities
 *
 * Supports:
 * - NDJSON: Newline-delimited JSON for streaming
 * - Pretty: Human-readable formatted output
 * - Cursor persistence: Save/load cursor from file
 */

import { writeFile, readFile } from "fs/promises"
import { existsSync } from "fs"
import chalk from "chalk"
import type { SSEEventInfo } from "@opencode-vibe/core/world"
export type { SSEEventInfo }

/**
 * Color mapping for event source tags
 * Each source gets a distinct color for easy visual scanning
 */
const SOURCE_COLORS: Record<string, (text: string) => string> = {
	sse: chalk.cyan,
	"swarm-db": chalk.yellow,
	"swarm-mail": chalk.magenta,
	webhook: chalk.green,
	polling: chalk.blue,
}

/**
 * Default color for unknown sources
 */
const DEFAULT_SOURCE_COLOR = chalk.gray

/**
 * Format source tag with color
 */
export function colorSourceTag(source: string): string {
	const colorFn = SOURCE_COLORS[source] || DEFAULT_SOURCE_COLOR
	return colorFn(`[${source}]`)
}

export type OutputMode = "json" | "pretty"

export interface OutputConfig {
	mode: OutputMode
	cursorFile?: string
}

/**
 * Write NDJSON (newline-delimited JSON) output
 */
export function writeNDJSON(data: unknown): void {
	console.log(JSON.stringify(data))
}

/**
 * Write pretty-formatted output
 */
export function writePretty(label: string, value: unknown): void {
	if (typeof value === "object" && value !== null) {
		console.log(`${label}:`)
		console.log(JSON.stringify(value, null, 2))
	} else {
		console.log(`${label}: ${value}`)
	}
}

/**
 * Write output based on mode
 */
export function write(config: OutputConfig, data: unknown, label?: string): void {
	if (config.mode === "json") {
		writeNDJSON(data)
	} else {
		writePretty(label || "Output", data)
	}
}

/**
 * Write error output
 */
export function writeError(message: string, details?: unknown): void {
	if (details) {
		console.error(`Error: ${message}`)
		console.error(JSON.stringify(details, null, 2))
	} else {
		console.error(`Error: ${message}`)
	}
}

/**
 * Save cursor to file
 */
export async function saveCursor(cursorFile: string, cursor: string): Promise<void> {
	await writeFile(cursorFile, cursor, "utf-8")
}

/**
 * Load cursor from file
 * Returns null if file doesn't exist
 */
export async function loadCursor(cursorFile: string): Promise<string | null> {
	if (!existsSync(cursorFile)) {
		return null
	}
	try {
		return await readFile(cursorFile, "utf-8")
	} catch {
		return null
	}
}

/**
 * Add progressive discovery links to JSON output
 */
export function withLinks(
	data: Record<string, unknown>,
	links: Record<string, string>,
): Record<string, unknown> {
	return {
		...data,
		_links: links,
	}
}

/**
 * Format "Next steps" section for help text
 */
export function formatNextSteps(steps: string[]): string {
	return `
Next steps:
${steps.map((step) => `  ${step}`).join("\n")}
`
}

/**
 * Format timestamp as HH:MM:SS
 */
function formatTimestamp(date: Date): string {
	const hours = String(date.getHours()).padStart(2, "0")
	const minutes = String(date.getMinutes()).padStart(2, "0")
	const seconds = String(date.getSeconds()).padStart(2, "0")
	return `${hours}:${minutes}:${seconds}`
}

/**
 * Extract key identifiers from event properties
 */
function extractIdentifiers(event: SSEEventInfo): string {
	const { type, properties } = event

	switch (type) {
		case "session.created":
		case "session.updated":
		case "session.status": {
			const sessionID = properties.sessionID as string | undefined
			const status = properties.status as string | undefined
			if (status) {
				return `${sessionID} → ${status}`
			}
			return sessionID || ""
		}

		case "message.created":
		case "message.updated": {
			const sessionID = properties.sessionID as string | undefined
			const messageID = properties.id as string | undefined
			const tokens = properties.totalTokens as number | undefined
			const path = `${sessionID}/${messageID}`
			if (tokens !== undefined) {
				return `${path} (tokens: ${tokens})`
			}
			return path
		}

		case "part.created":
		case "part.updated":
		case "message.part.updated": {
			// message.part.updated wraps data in "part" property
			const partData =
				type === "message.part.updated"
					? ((properties.part as Record<string, unknown> | undefined) ?? properties)
					: properties
			const sessionID = partData.sessionID as string | undefined
			const messageID = partData.messageID as string | undefined
			const partID = partData.id as string | undefined
			return `${sessionID}/${messageID}/${partID}`
		}

		default:
			return JSON.stringify(properties)
	}
}

/**
 * Format a single SSE event for display
 *
 * Format: "[source] HH:MM:SS event.type          identifier info"
 * Example: "[sse] 18:45:32 session.status      ses_abc123 → running"
 */
export function formatSSEEvent(event: SSEEventInfo): string {
	const timestamp = formatTimestamp(new Date())
	const eventType = event.type.padEnd(20, " ")
	const identifiers = extractIdentifiers(event)
	const source = event.source || "sse"
	const sourceTag = colorSourceTag(source)

	return `${sourceTag} ${timestamp} ${eventType} ${identifiers}`
}

/**
 * Streaming event types that should be aggregated
 */
const STREAMING_EVENT_TYPES = new Set(["message.part.updated"])

/**
 * Events that signal end of streaming
 */
const SESSION_END_TYPES = new Set(["session.completed", "session.failed"])

/**
 * Streaming state for a session
 */
interface StreamingState {
	sessionID: string
	eventType: string
	count: number
	startTime: number
	lastEmitTime: number
	source?: string
	completed: boolean
}

/**
 * Result from processing an event
 */
export interface AggregatorResult {
	line: string
	summary?: boolean // True if this is a summary line, not original event
}

/**
 * Aggregates rapid streaming events into throttled summary lines
 *
 * Instead of emitting 47 separate "message.part.updated" events,
 * emits summary lines like: "[sse] 12:34:05 streaming ses_abc... 47 parts"
 */
export class StreamingAggregator {
	private streams = new Map<string, StreamingState>()
	private throttleMs: number

	constructor(options: { throttleMs?: number } = {}) {
		this.throttleMs = options.throttleMs ?? 500 // Default 500ms
	}

	/**
	 * Process an event and return formatted line(s) to display
	 * Returns null if event should be suppressed (aggregated)
	 */
	process(event: SSEEventInfo): AggregatorResult | null {
		const { type, properties } = event
		// For message.part.updated, sessionID is nested in properties.part
		const sessionID =
			type === "message.part.updated"
				? ((properties.part as Record<string, unknown> | undefined)?.sessionID as
						| string
						| undefined)
				: (properties.sessionID as string | undefined)

		if (!sessionID) {
			// No sessionID, can't aggregate - format normally
			return { line: formatSSEEvent(event) }
		}

		const streamKey = `${sessionID}:${type}`
		const now = Date.now()

		// Check if this is a streaming event type
		if (STREAMING_EVENT_TYPES.has(type)) {
			const existing = this.streams.get(streamKey)

			if (!existing) {
				// First streaming event for this session/type
				this.streams.set(streamKey, {
					sessionID,
					eventType: type,
					count: 1,
					startTime: now,
					lastEmitTime: now,
					source: event.source,
					completed: false,
				})

				// Emit "streaming started" line
				const source = event.source || "sse"
				const sourceTag = colorSourceTag(source)
				const timestamp = formatTimestamp(new Date())
				return {
					line: `${sourceTag} ${timestamp} streaming            ${sessionID}... (1 part)`,
					summary: true,
				}
			}

			// Increment count
			existing.count++

			// Check if throttle interval passed
			const timeSinceLastEmit = now - existing.lastEmitTime
			if (timeSinceLastEmit >= this.throttleMs) {
				// Emit summary
				existing.lastEmitTime = now
				return this.emitSummary(existing)
			}

			// Suppress event (still aggregating)
			return null
		}

		// Non-streaming event - check if we need to finalize any active streams
		// Find any stream for this sessionID
		let finalSummary: AggregatorResult | null = null
		for (const [key, stream] of this.streams.entries()) {
			if (stream.sessionID === sessionID) {
				stream.completed = true
				finalSummary = this.emitSummary(stream)
				this.streams.delete(key)
				break // Only finalize one stream per event
			}
		}

		// Session end events should finalize stream but also display
		if (SESSION_END_TYPES.has(type)) {
			// Return the final summary if we had one
			if (finalSummary) {
				return finalSummary
			}
		}

		// Regular event - format normally
		return { line: formatSSEEvent(event) }
	}

	/**
	 * Emit summary line for a streaming state
	 */
	private emitSummary(state: StreamingState): AggregatorResult {
		const source = state.source || "sse"
		const sourceTag = colorSourceTag(source)
		const timestamp = formatTimestamp(new Date())
		const sessionShort = state.sessionID.slice(0, 10)
		const completedIndicator = state.completed ? " ✓" : ""
		return {
			line: `${sourceTag} ${timestamp} streaming            ${sessionShort}... (${state.count} parts)${completedIndicator}`,
			summary: true,
		}
	}

	/**
	 * Get active stream count (for debugging)
	 */
	getActiveStreams(): number {
		return this.streams.size
	}
}

/**
 * Groups events by source and formats them with section headers
 *
 * Instead of interleaved events:
 *   [sse] 18:45:32 session.status
 *   [swarm-db] 18:45:33 agent.start
 *   [sse] 18:45:34 streaming
 *
 * Outputs grouped view:
 *   ━━━ SSE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *     :32 session.status       ses_abc123
 *     :34 streaming            ses_abc123... (12 parts)
 *
 *   ━━━ SWARM-DB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *     :33 agent.start          bd-123
 */
export class GroupedEventLog {
	private groups = new Map<string, SSEEventInfo[]>()
	private maxEventsPerGroup: number

	constructor(options: { maxEventsPerGroup?: number } = {}) {
		this.maxEventsPerGroup = options.maxEventsPerGroup ?? 10
	}

	/**
	 * Add an event to the log
	 * Trims older events when limit is exceeded (keeps most recent)
	 */
	addEvent(event: SSEEventInfo): void {
		const source = event.source || "sse"
		const existing = this.groups.get(source) || []
		existing.push(event)

		// Trim to maxEventsPerGroup if exceeded (keep last N events)
		if (existing.length > this.maxEventsPerGroup) {
			existing.splice(0, existing.length - this.maxEventsPerGroup)
		}

		this.groups.set(source, existing)
	}

	/**
	 * Format all events grouped by source with colored section headers
	 */
	format(): string {
		const sections: string[] = []

		for (const [source, events] of this.groups.entries()) {
			// Get color function for this source
			const colorFn = SOURCE_COLORS[source] || DEFAULT_SOURCE_COLOR

			// Section header: ━━━ SOURCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
			const headerText = ` ${source.toUpperCase()} `
			const separator = "━".repeat(50 - headerText.length)
			const header = colorFn(`━━━${headerText}${separator}`)

			// Format events (simplified format without source tag since it's in header)
			const eventLines = events.map((event) => {
				const timestamp = formatTimestamp(new Date())
				const timeOnly = timestamp.slice(-5) // Get :MM:SS part
				const eventType = event.type.padEnd(20, " ")
				const identifiers = extractIdentifiers(event)
				return `  ${timeOnly} ${eventType} ${identifiers}`
			})

			sections.push(header)
			sections.push(...eventLines)
			sections.push("") // Blank line between sections
		}

		return sections.join("\n")
	}
}
