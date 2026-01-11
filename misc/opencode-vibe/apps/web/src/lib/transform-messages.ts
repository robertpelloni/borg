/**
 * Transform layer: OpenCode SDK types → ai-elements UIMessage types
 *
 * This module handles the conversion between OpenCode's {info, parts} message structure
 * and the ai-elements library's UIMessage format used for rendering.
 */

import type {
	Message,
	Part,
	TextPart,
	ReasoningPart,
	FilePart,
	ToolPart,
	ToolState,
} from "@opencode-ai/sdk/client"
import type { UIMessage } from "ai"

/**
 * UIPart types for our transform layer
 * We define these locally to avoid generic type complexity from the ai package
 * These match the shapes expected by ai-elements components
 */
type TextUIPart = { type: "text"; text: string }
type ReasoningUIPart = { type: "reasoning"; text: string }
type FileUIPart = {
	type: "file"
	filename?: string
	mediaType: string
	url: string
}
type StepStartUIPart = { type: "step-start" }
type ToolUIPart = {
	type: `tool-${string}`
	toolCallId: string
	title?: string
	state: "input-streaming" | "input-available" | "output-available" | "output-error"
	input?: unknown
	output?: unknown
	errorText?: string
	/** Preserve original OpenCode ToolPart for enhanced display */
	_opencode?: ToolPart
}

type SupportedUIPart = TextUIPart | ReasoningUIPart | FileUIPart | StepStartUIPart | ToolUIPart

/**
 * OpenCode API returns messages as {info: Message, parts: Part[]}
 * This type represents that envelope structure
 *
 * Note: We use a loose type for info to support both SDK Message and store Message types
 */
export type OpencodeMessage = {
	info: {
		id: string
		role: string
		parentID?: string
		time?: { created: number; completed?: number }
		finish?: string
	}
	parts: Part[]
}

/**
 * Tool state mapping: OpenCode → ai-elements
 *
 * OpenCode states: pending | running | completed | error
 * ai-elements states: input-streaming | input-available | output-available | output-error | etc.
 */
function transformToolState(
	state: ToolState,
): "input-streaming" | "input-available" | "output-available" | "output-error" {
	switch (state.status) {
		case "pending":
			return "input-streaming"
		case "running":
			return "input-available"
		case "completed":
			return "output-available"
		case "error":
			return "output-error"
	}
}

/**
 * Sanitize a string for use as part of an HTML element name.
 * Removes/replaces characters that are invalid in custom element names.
 * Valid: letters, digits, hyphens, underscores, periods
 * Invalid: < > & " ' / = spaces and most special chars
 */
function sanitizeForElementName(name: string): string {
	return name.replace(/[^a-zA-Z0-9\-_.]/g, "_")
}

/**
 * Transform individual part from OpenCode SDK to ai-elements UIPart
 */
export function transformPart(part: Part): SupportedUIPart | null {
	switch (part.type) {
		case "text": {
			const textPart = part as TextPart
			return {
				type: "text",
				text: textPart.text,
			}
		}

		case "reasoning": {
			const reasoningPart = part as ReasoningPart
			return {
				type: "reasoning",
				text: reasoningPart.text,
			}
		}

		case "file": {
			const filePart = part as FilePart
			return {
				type: "file",
				filename: filePart.filename,
				mediaType: filePart.mime,
				url: filePart.url,
			}
		}

		case "tool": {
			const toolPart = part as ToolPart
			const state = transformToolState(toolPart.state)

			// Sanitize tool name - can contain invalid chars like < >
			const sanitizedToolName = sanitizeForElementName(toolPart.tool)

			// Base tool UIPart structure
			const baseTool = {
				type: `tool-${sanitizedToolName}` as const,
				toolCallId: toolPart.callID,
				title: "title" in toolPart.state ? toolPart.state.title : toolPart.tool,
			}

			// Map state-specific fields
			switch (state) {
				case "input-streaming":
					return {
						...baseTool,
						state: "input-streaming" as const,
						input: "input" in toolPart.state ? toolPart.state.input : undefined,
						_opencode: toolPart,
					}

				case "input-available":
					return {
						...baseTool,
						state: "input-available" as const,
						input: "input" in toolPart.state ? toolPart.state.input : {},
						_opencode: toolPart,
					}

				case "output-available":
					return {
						...baseTool,
						state: "output-available" as const,
						input: "input" in toolPart.state ? toolPart.state.input : {},
						output: "output" in toolPart.state ? toolPart.state.output : undefined,
						_opencode: toolPart,
					}

				case "output-error":
					return {
						...baseTool,
						state: "output-error" as const,
						input: "input" in toolPart.state ? toolPart.state.input : {},
						errorText: "error" in toolPart.state ? toolPart.state.error : "Unknown error",
						_opencode: toolPart,
					}
			}
			break
		}

		case "step-start": {
			return {
				type: "step-start",
			}
		}

		// OpenCode-specific parts that need custom components
		case "step-finish":
		case "snapshot":
		case "patch":
		case "agent":
		case "retry":
		case "compaction":
			return null

		default:
			return null
	}
}

/**
 * Extended UIMessage with OpenCode-specific metadata
 */
export type ExtendedUIMessage = UIMessage & {
	/** Original OpenCode message info for status detection */
	_opencode?: {
		parentID?: string
		time?: { created: number; completed?: number }
		finish?: string
	}
}

/**
 * Transform OpenCode message envelope to ai-elements UIMessage
 */
export function transformMessage(opencodeMsg: OpencodeMessage): ExtendedUIMessage {
	const transformedParts = opencodeMsg.parts
		.map(transformPart)
		.filter((part): part is SupportedUIPart => part !== null)

	// Cast to access fields not in SDK types but present at runtime
	const info = opencodeMsg.info as Message & {
		parentID?: string
		finish?: string
	}

	return {
		id: info.id,
		role: info.role,
		parts: transformedParts as UIMessage["parts"],
		// Preserve metadata for pending/processing detection
		_opencode: {
			parentID: info.parentID,
			time: info.time,
			finish: info.finish,
		},
	}
}

/**
 * Batch transform multiple OpenCode messages
 */
export function transformMessages(opencodeMessages: OpencodeMessage[]): UIMessage[] {
	return opencodeMessages.map(transformMessage)
}
