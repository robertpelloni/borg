/**
 * @opencode-vibe/core/types
 *
 * Type definitions for OpenCode core package.
 */

export type {
	TextPart,
	FileAttachmentPart,
	ImageAttachmentPart,
	PromptPart,
	Prompt,
	SlashCommand,
	ApiTextPart,
	ApiFilePart,
	ApiImagePart,
	ApiPart,
} from "./prompt.js"

export type { Session, Message, Part, SessionWithStatus } from "./domain.js"

export type { MessageWithParts } from "./messages.js"

export type { BackendSessionStatus, normalizeBackendStatus } from "./sessions.js"

export type {
	GlobalEvent,
	SessionStatus,
	DiscoveredServer,
	ConnectionState,
	ConnectionStateExtended,
	SSEState,
} from "./events.js"
