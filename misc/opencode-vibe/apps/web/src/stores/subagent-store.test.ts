/**
 * Tests for subagent store
 */

import { describe, expect, test, beforeEach } from "vitest"
import { useSubagentStore } from "./subagent-store"
import type { Message, Part } from "@/app/hooks"

describe("useSubagentStore", () => {
	beforeEach(() => {
		// Reset store state before each test
		useSubagentStore.setState({
			sessions: {},
			partToSession: {},
			expanded: new Set(),
		})
	})

	describe("registerSubagent", () => {
		test("creates new session with correct structure", () => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session).toBeDefined()
			expect(session?.id).toBe("child-123")
			expect(session?.parentSessionId).toBe("parent-456")
			expect(session?.parentPartId).toBe("part-789")
			expect(session?.agentName).toBe("TestAgent")
			expect(session?.status).toBe("running")
			expect(session?.messages).toEqual([])
			expect(session?.parts).toEqual({})
		})

		test("creates mapping from parent part to child session", () => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")

			const state = useSubagentStore.getState()
			expect(state.partToSession["part-789"]).toBe("child-123")
		})
	})

	describe("addMessage", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		test("adds message to session", () => {
			const message: Message = {
				id: "msg-1",
				sessionID: "child-123",
				role: "user",
			}

			useSubagentStore.getState().addMessage("child-123", message)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.messages).toHaveLength(1)
			expect(session?.messages[0]).toEqual(message)
		})

		test("initializes empty parts array for message", () => {
			const message: Message = {
				id: "msg-1",
				sessionID: "child-123",
				role: "user",
			}

			useSubagentStore.getState().addMessage("child-123", message)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.parts["msg-1"]).toEqual([])
		})

		test("does nothing if session doesn't exist", () => {
			const message: Message = {
				id: "msg-1",
				sessionID: "nonexistent",
				role: "user",
			}

			useSubagentStore.getState().addMessage("nonexistent", message)

			const state = useSubagentStore.getState()
			expect(state.sessions["nonexistent"]).toBeUndefined()
		})
	})

	describe("updateMessage", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			useSubagentStore.getState().addMessage("child-123", {
				id: "msg-1",
				sessionID: "child-123",
				role: "user",
			})
		})

		test("updates existing message", () => {
			const updatedMessage: Message = {
				id: "msg-1",
				sessionID: "child-123",
				role: "user",
				finish: "stop",
			}

			useSubagentStore.getState().updateMessage("child-123", updatedMessage)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.messages[0]?.finish).toBe("stop")
		})

		test("does nothing if message doesn't exist", () => {
			const updatedMessage: Message = {
				id: "msg-999",
				sessionID: "child-123",
				role: "user",
			}

			useSubagentStore.getState().updateMessage("child-123", updatedMessage)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.messages).toHaveLength(1)
			expect(session?.messages[0]?.id).toBe("msg-1")
		})
	})

	describe("addPart", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			useSubagentStore.getState().addMessage("child-123", {
				id: "msg-1",
				sessionID: "child-123",
				role: "assistant",
			})
		})

		test("adds part to message parts array", () => {
			const part: Part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Hello",
			}

			useSubagentStore.getState().addPart("child-123", "msg-1", part)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.parts["msg-1"]).toHaveLength(1)
			expect(session?.parts["msg-1"]?.[0]).toEqual(part)
		})

		test("initializes parts array if it doesn't exist", () => {
			// Add a message without going through addMessage (direct state manipulation)
			useSubagentStore.setState((state) => {
				const session = state.sessions["child-123"]
				if (session) {
					session.messages.push({
						id: "msg-2",
						sessionID: "child-123",
						role: "assistant",
					})
				}
			})

			const part: Part = {
				id: "part-1",
				messageID: "msg-2",
				type: "text",
				content: "Hello",
			}

			useSubagentStore.getState().addPart("child-123", "msg-2", part)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.parts["msg-2"]).toBeDefined()
			expect(session?.parts["msg-2"]).toHaveLength(1)
		})
	})

	describe("updatePart", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			useSubagentStore.getState().addMessage("child-123", {
				id: "msg-1",
				sessionID: "child-123",
				role: "assistant",
			})
			useSubagentStore.getState().addPart("child-123", "msg-1", {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Hello",
			})
		})

		test("updates existing part", () => {
			const updatedPart: Part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Hello World",
			}

			useSubagentStore.getState().updatePart("child-123", "msg-1", updatedPart)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Hello World")
		})

		test("does nothing if part doesn't exist", () => {
			const updatedPart: Part = {
				id: "part-999",
				messageID: "msg-1",
				type: "text",
				content: "Nope",
			}

			useSubagentStore.getState().updatePart("child-123", "msg-1", updatedPart)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.parts["msg-1"]).toHaveLength(1)
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Hello")
		})
	})

	describe("setStatus", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		test("updates session status", () => {
			useSubagentStore.getState().setStatus("child-123", "completed")

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.status).toBe("completed")
		})

		test("can set error status", () => {
			useSubagentStore.getState().setStatus("child-123", "error")

			const state = useSubagentStore.getState()
			const session = state.sessions["child-123"]
			expect(session?.status).toBe("error")
		})
	})

	describe("toggleExpanded", () => {
		test("adds part ID to expanded set when not present", () => {
			useSubagentStore.getState().toggleExpanded("part-789")

			const state = useSubagentStore.getState()
			expect(state.expanded.has("part-789")).toBe(true)
		})

		test("removes part ID from expanded set when present", () => {
			useSubagentStore.getState().toggleExpanded("part-789")
			useSubagentStore.getState().toggleExpanded("part-789")

			const state = useSubagentStore.getState()
			expect(state.expanded.has("part-789")).toBe(false)
		})
	})

	describe("isExpanded", () => {
		test("returns true when part is expanded", () => {
			useSubagentStore.getState().toggleExpanded("part-789")

			expect(useSubagentStore.getState().isExpanded("part-789")).toBe(true)
		})

		test("returns false when part is not expanded", () => {
			expect(useSubagentStore.getState().isExpanded("part-789")).toBe(false)
		})
	})

	describe("getByParentPart", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		test("returns session for registered parent part", () => {
			const session = useSubagentStore.getState().getByParentPart("part-789")

			expect(session).toBeDefined()
			expect(session?.id).toBe("child-123")
			expect(session?.parentPartId).toBe("part-789")
		})

		test("returns undefined for unregistered parent part", () => {
			const session = useSubagentStore.getState().getByParentPart("nonexistent")

			expect(session).toBeUndefined()
		})
	})

	describe("updateParentPartId", () => {
		test("updates parentPartId and creates partToSession mapping", () => {
			// Register with empty parentPartId (as session.created does)
			useSubagentStore.getState().registerSubagent("child-123", "parent-456", "", "TestAgent")

			// Verify initial state - no mapping
			let state = useSubagentStore.getState()
			expect(state.sessions["child-123"]?.parentPartId).toBe("")
			expect(state.partToSession["part-789"]).toBeUndefined()

			// Update when Task tool part arrives
			useSubagentStore.getState().updateParentPartId("child-123", "part-789")

			// Verify parentPartId is updated
			state = useSubagentStore.getState()
			expect(state.sessions["child-123"]?.parentPartId).toBe("part-789")
			expect(state.partToSession["part-789"]).toBe("child-123")
		})

		test("does nothing if session doesn't exist", () => {
			useSubagentStore.getState().updateParentPartId("nonexistent", "part-789")

			const state = useSubagentStore.getState()
			expect(state.partToSession["part-789"]).toBeUndefined()
		})

		test("overwrites existing parentPartId if called multiple times", () => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-old", "TestAgent")

			useSubagentStore.getState().updateParentPartId("child-123", "part-new")

			const state = useSubagentStore.getState()
			expect(state.sessions["child-123"]?.parentPartId).toBe("part-new")
			expect(state.partToSession["part-new"]).toBe("child-123")
			// Old mapping should still exist (not cleaned up - acceptable tradeoff)
			expect(state.partToSession["part-old"]).toBe("child-123")
		})
	})
})
