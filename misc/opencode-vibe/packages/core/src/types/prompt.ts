/**
 * Prompt part types for rich text input with file attachments and images.
 * Uses discriminated union pattern with 'type' field for type safety.
 */

export interface TextPart {
	type: "text"
	content: string
	start: number
	end: number
}

export interface FileAttachmentPart {
	type: "file"
	path: string
	content: string // Display text like "@src/app.ts"
	start: number
	end: number
	selection?: {
		startLine: number
		endLine: number
	}
}

export interface ImageAttachmentPart {
	type: "image"
	id: string
	filename: string
	mime: string
	dataUrl: string
}

export type PromptPart = TextPart | FileAttachmentPart | ImageAttachmentPart
export type Prompt = PromptPart[]

export interface SlashCommand {
	id: string
	trigger: string
	title: string
	description?: string
	keybind?: string
	type: "builtin" | "custom"
}

/**
 * API part types - format expected by OpenCode server
 */

export interface ApiTextPart {
	type: "text"
	text: string
	id: string
}

export interface ApiFilePart {
	type: "file"
	mime: string
	url: string
	filename: string
}

export interface ApiImagePart {
	type: "image"
	mime: string
	url: string
	filename: string
}

export type ApiPart = ApiTextPart | ApiFilePart | ApiImagePart
