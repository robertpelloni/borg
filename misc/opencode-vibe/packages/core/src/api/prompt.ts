/**
 * Prompt API - Utility functions
 *
 * Re-export of PromptUtil for consistency with other API modules.
 * PromptUtil contains pure functions (no Effect programs).
 *
 * @module api/prompt
 */

import { PromptUtil } from "../atoms/prompt.js"
import type {
	Prompt,
	SlashCommand,
	ApiPart,
	ApiTextPart,
	ApiFilePart,
	ApiImagePart,
} from "../types/prompt.js"
import type { AutocompleteState } from "../atoms/prompt.js"

/**
 * Generate a unique ID for a part (simple counter-based for now)
 */
let partIdCounter = 0
function generatePartId(): string {
	return `part-${Date.now()}-${partIdCounter++}`
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
	const mimeTypes: Record<string, string> = {
		// Text files
		txt: "text/plain",
		md: "text/markdown",
		json: "application/json",
		js: "text/javascript",
		ts: "text/plain",
		tsx: "text/plain",
		jsx: "text/plain",
		css: "text/css",
		html: "text/html",
		xml: "text/xml",
		yaml: "text/yaml",
		yml: "text/yaml",

		// Images
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		webp: "image/webp",
	}

	return mimeTypes[ext] || "text/plain"
}

/**
 * Convert client-side prompt parts to API format
 *
 * @param parts - Client-side prompt parts with start/end positions
 * @param directory - Base directory for resolving relative file paths
 * @returns Array of API parts ready to send to server
 */
export function convertToApiParts(parts: Prompt, directory: string): ApiPart[] {
	const result: ApiPart[] = []

	for (const part of parts) {
		if (part.type === "text") {
			result.push({
				type: "text",
				text: part.content,
				id: generatePartId(),
			} satisfies ApiTextPart)
		} else if (part.type === "file") {
			// Convert relative path to absolute file:// URL
			const absolutePath = part.path.startsWith("/") ? part.path : `${directory}/${part.path}`

			// Extract filename from path
			const filename = part.path.split("/").pop() || "file"

			// Determine mime type from extension (simple heuristic)
			const ext = filename.split(".").pop()?.toLowerCase()
			const mime = getMimeType(ext || "")

			result.push({
				type: "file",
				mime,
				url: `file://${absolutePath}`,
				filename,
			} satisfies ApiFilePart)
		} else {
			// image part - uses dataUrl from ImageAttachmentPart
			result.push({
				type: "image",
				mime: part.mime,
				url: part.dataUrl,
				filename: part.filename,
			} satisfies ApiImagePart)
		}
	}

	return result
}

/**
 * Prompt API namespace
 *
 * Pure utility functions for prompt operations.
 */
export const prompt = {
	/**
	 * Insert a file part into a prompt at a specific position
	 *
	 * @param parts - Current prompt parts
	 * @param path - File path to insert
	 * @param atPosition - Character position to insert at
	 * @param replaceLength - Number of characters to replace (for autocomplete)
	 * @returns New parts array with file inserted and new cursor position
	 */
	insertFilePart: PromptUtil.insertFilePart,

	/**
	 * Navigate autocomplete selection up or down
	 *
	 * @param currentIndex - Current selected index
	 * @param direction - "up" or "down"
	 * @param itemsLength - Total number of items
	 * @returns New selected index
	 */
	navigateAutocomplete: PromptUtil.navigateAutocomplete,

	/**
	 * Convert client-side prompt parts to API format
	 */
	convertToApiParts,
}

// Export types for consumers
export type {
	Prompt,
	SlashCommand,
	AutocompleteState,
	ApiPart,
	ApiTextPart,
	ApiFilePart,
	ApiImagePart,
}
