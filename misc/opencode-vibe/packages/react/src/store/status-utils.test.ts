/**
 * Tests for deriveSessionStatus utility
 *
 * TDD approach: RED → GREEN → REFACTOR
 */

import { describe, it, expect } from "vitest"
import { deriveSessionStatus } from "./status-utils"
import type { DirectoryState, Message, Part, Session } from "./types"

/**
 * Helper to create minimal DirectoryState for testing
 */
function createDirectoryState(overrides: Partial<DirectoryState> = {}): DirectoryState {
	return {
		ready: true,
		sessions: [],
		sessionStatus: {},
		sessionLastActivity: {},
		sessionDiff: {},
		todos: {},
		messages: {},
		parts: {},
		contextUsage: {},
		compaction: {},
		modelLimits: {},
		...overrides,
	}
}

/**
 * Helper to create minimal OpencodeState for testing
 */
function createOpencodeState(directory: string, dirState: DirectoryState) {
	return {
		directories: {
			[directory]: dirState,
		},
	}
}

describe("deriveSessionStatus", () => {
	const sessionId = "test-session-123"
	const directory = "/test/directory"

	it("returns 'completed' for unknown session (no directory)", () => {
		const state = { directories: {} }
		const result = deriveSessionStatus(state, sessionId, directory)
		expect(result).toBe("completed")
	})

	it("returns 'running' when sessionStatus map has running status", () => {
		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "running",
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory)
		expect(result).toBe("running")
	})

	it("returns 'running' when sub-agent task is running", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "assistant",
			time: { created: Date.now() },
		}
		const taskPart: Part = {
			id: "part-task-1",
			messageID: messageId,
			type: "tool",
			tool: "task",
			content: "",
			state: {
				status: "running",
			},
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed", // Main session completed
			},
			messages: {
				[sessionId]: [message],
			},
			parts: {
				[messageId]: [taskPart],
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory)
		expect(result).toBe("running")
	})

	it("returns 'running' when last message is incomplete assistant message", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "assistant",
			time: { created: Date.now() }, // No completed time
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed", // Main session completed
			},
			messages: {
				[sessionId]: [message],
			},
			parts: {
				[messageId]: [], // No parts
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory, {
			includeLastMessage: true,
		})
		expect(result).toBe("running")
	})

	it("returns 'completed' when last message check disabled", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "assistant",
			time: { created: Date.now() }, // No completed time
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed",
			},
			messages: {
				[sessionId]: [message],
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory, {
			includeLastMessage: false, // Explicit disable
		})
		expect(result).toBe("completed")
	})

	it("returns 'completed' when sub-agent check disabled", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "assistant",
			time: { created: Date.now() },
		}
		const taskPart: Part = {
			id: "part-task-1",
			messageID: messageId,
			type: "tool",
			tool: "task",
			content: "",
			state: {
				status: "running",
			},
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed",
			},
			messages: {
				[sessionId]: [message],
			},
			parts: {
				[messageId]: [taskPart],
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory, {
			includeSubAgents: false, // Explicit disable
		})
		expect(result).toBe("completed")
	})

	it("prioritizes main status over sub-agents", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "assistant",
			time: { created: Date.now() },
		}
		const taskPart: Part = {
			id: "part-task-1",
			messageID: messageId,
			type: "tool",
			tool: "task",
			content: "",
			state: {
				status: "completed", // Sub-agent completed
			},
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "running", // Main status running
			},
			messages: {
				[sessionId]: [message],
			},
			parts: {
				[messageId]: [taskPart],
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory)
		expect(result).toBe("running")
	})

	it("returns 'completed' when session has no messages", () => {
		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed",
			},
			messages: {}, // No messages
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory, {
			includeSubAgents: true,
			includeLastMessage: true,
		})
		expect(result).toBe("completed")
	})

	it("returns 'completed' when last message is user message", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "user", // User message, not assistant
			time: { created: Date.now() },
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed",
			},
			messages: {
				[sessionId]: [message],
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory, {
			includeLastMessage: true,
		})
		expect(result).toBe("completed")
	})

	it("returns 'completed' when last assistant message has completed time", () => {
		const messageId = "msg-123"
		const message: Message = {
			id: messageId,
			sessionID: sessionId,
			role: "assistant",
			time: { created: Date.now(), completed: Date.now() }, // Has completed time
		}

		const dirState = createDirectoryState({
			sessionStatus: {
				[sessionId]: "completed",
			},
			messages: {
				[sessionId]: [message],
			},
		})
		const state = createOpencodeState(directory, dirState)

		const result = deriveSessionStatus(state, sessionId, directory, {
			includeLastMessage: true,
		})
		expect(result).toBe("completed")
	})
})
