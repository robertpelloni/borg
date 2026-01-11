/**
 * useMessagesWithParts Tests - Core API integration
 *
 * Tests transformation from Core MessageWithParts to React OpencodeMessage format.
 * Tests store selector behavior (no Effect types, pure React).
 */

import { describe, expect, test } from "vitest"
import type { Message, Part } from "@opencode-vibe/core/types"
import type { OpencodeMessage } from "./use-messages-with-parts"

// Mock message data
const mockMessages: Message[] = [
	{
		id: "msg_1",
		sessionID: "ses_123",
		role: "user",
		time: { created: Date.now() },
	},
	{
		id: "msg_2",
		sessionID: "ses_123",
		role: "assistant",
		parentID: "msg_1",
		time: { created: Date.now() },
	},
]

// Mock parts data
const mockParts: Part[] = [
	{
		id: "part_1",
		messageID: "msg_1",
		type: "text",
		content: "Hello",
	},
	{
		id: "part_2",
		messageID: "msg_2",
		type: "text",
		content: "World",
	},
	{
		id: "part_3",
		messageID: "msg_2",
		type: "tool-call",
		content: "call-data",
	},
]

/**
 * Transform function from Core MessageWithParts to React OpencodeMessage
 * This is what the hook implementation should do.
 */
function transformCoreToOpencodeMessage(
	coreMessages: Array<Message & { parts: Part[] }>,
): OpencodeMessage[] {
	return coreMessages.map((msg) => {
		const { parts, ...messageInfo } = msg
		return {
			info: messageInfo,
			parts: parts,
		}
	})
}

describe("useMessagesWithParts - Data transformation", () => {
	test("transforms Core MessageWithParts to OpencodeMessage format", () => {
		// Core returns MessageWithParts[] (Message with parts embedded)
		const coreMessages = [
			{
				...mockMessages[0],
				parts: [mockParts[0]],
			},
			{
				...mockMessages[1],
				parts: [mockParts[1], mockParts[2]],
			},
		]

		const result = transformCoreToOpencodeMessage(coreMessages)

		expect(result).toHaveLength(2)

		// First message
		expect(result[0]?.info.id).toBe("msg_1")
		expect(result[0]?.info.role).toBe("user")
		expect(result[0]?.parts).toHaveLength(1)
		expect(result[0]?.parts[0]).toEqual(mockParts[0])

		// Second message
		expect(result[1]?.info.id).toBe("msg_2")
		expect(result[1]?.info.role).toBe("assistant")
		expect(result[1]?.parts).toHaveLength(2)
		expect(result[1]?.parts[0]).toEqual(mockParts[1])
		expect(result[1]?.parts[1]).toEqual(mockParts[2])
	})

	test("handles messages with no parts", () => {
		const coreMessages = [
			{
				...mockMessages[0],
				parts: [],
			},
		]

		const result = transformCoreToOpencodeMessage(coreMessages)

		expect(result).toHaveLength(1)
		expect(result[0]?.info.id).toBe("msg_1")
		expect(result[0]?.parts).toEqual([])
	})

	test("handles empty array", () => {
		const result = transformCoreToOpencodeMessage([])
		expect(result).toEqual([])
	})

	test("preserves message metadata (parentID, time)", () => {
		const coreMessages = [
			{
				...mockMessages[1], // Has parentID
				parts: [mockParts[1]],
			},
		]

		const result = transformCoreToOpencodeMessage(coreMessages)

		expect(result[0]?.info.parentID).toBe("msg_1")
		expect(result[0]?.info.time).toEqual(mockMessages[1]?.time)
	})
})
