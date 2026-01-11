/**
 * Re-exports of official @opencode-ai/sdk types.
 * Use these instead of hand-rolled domain types.
 *
 * This provides a central location for SDK type imports and serves as
 * the contract between Core layer and backend SDK.
 */

// Domain Types
export type {
	Session,
	Message,
	UserMessage,
	AssistantMessage,
	FileDiff,
} from "@opencode-ai/sdk"

// Part Types
export type {
	Part,
	TextPart,
	ReasoningPart,
	FilePart,
	ToolPart,
	StepStartPart,
	StepFinishPart,
	SnapshotPart,
	PatchPart,
	AgentPart,
	RetryPart,
	CompactionPart,
} from "@opencode-ai/sdk"

// Event Types
export type {
	Event,
	EventMessagePartUpdated,
	EventSessionStatus,
	EventMessageUpdated,
	EventSessionCreated,
	EventSessionUpdated,
	EventSessionDeleted,
	EventSessionIdle,
	EventSessionCompacted,
	EventFileEdited,
	GlobalEvent,
} from "@opencode-ai/sdk"

// Status Types
export type {
	SessionStatus,
	ToolState,
	ToolStatePending,
	ToolStateRunning,
	ToolStateCompleted,
	ToolStateError,
} from "@opencode-ai/sdk"

// Error Types
export type {
	ProviderAuthError,
	UnknownError,
	MessageOutputLengthError,
	MessageAbortedError,
	ApiError,
} from "@opencode-ai/sdk"

// File/Source Types
export type {
	FileSource,
	SymbolSource,
	FilePartSource,
	FilePartSourceText,
	Range,
} from "@opencode-ai/sdk"

// Project/Config Types
export type { Project, Config } from "@opencode-ai/sdk"
