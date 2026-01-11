/**
 * useWorldConnection Tests
 *
 * TDD: Tests written FIRST
 * Tests the connection status hook that derives from useWorld()
 *
 * NO DOM TESTING - Tests pure function logic directly
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type { WorldState } from "@opencode-vibe/core/world"

// Mock useWorld hook
vi.mock("./use-world.js", () => ({
	useWorld: vi.fn(),
}))

import { useWorld } from "./use-world.js"
import { useWorldConnection, type ConnectionStatus } from "./use-world-connection.js"

const mockUseWorld = vi.mocked(useWorld)

describe("useWorldConnection", () => {
	const createMockWorldState = (connectionStatus: WorldState["connectionStatus"]): WorldState => ({
		sessions: [],
		activeSessionCount: 0,
		activeSession: null,
		connectionStatus,
		lastUpdated: Date.now(),
		byDirectory: new Map(),
		stats: { total: 0, active: 0, streaming: 0 },
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("returns connection status type", () => {
		mockUseWorld.mockReturnValue(createMockWorldState("connected"))

		const status = useWorldConnection()

		// Type assertion - ensures ConnectionStatus type is exported and correct
		const typed: ConnectionStatus = status
		expect(typed).toBe("connected")
	})

	it("returns initial connecting status", () => {
		mockUseWorld.mockReturnValue(createMockWorldState("connecting"))

		const status = useWorldConnection()

		expect(status).toBe("connecting")
	})

	it("returns connected status", () => {
		mockUseWorld.mockReturnValue(createMockWorldState("connected"))

		const status = useWorldConnection()

		expect(status).toBe("connected")
	})

	it("returns disconnected status", () => {
		mockUseWorld.mockReturnValue(createMockWorldState("disconnected"))

		const status = useWorldConnection()

		expect(status).toBe("disconnected")
	})

	it("returns error status", () => {
		mockUseWorld.mockReturnValue(createMockWorldState("error"))

		const status = useWorldConnection()

		expect(status).toBe("error")
	})

	it("derives from world.connectionStatus", () => {
		// Verify we're just selecting the property, not doing computation
		mockUseWorld.mockReturnValue(createMockWorldState("connecting"))
		expect(useWorldConnection()).toBe("connecting")

		mockUseWorld.mockReturnValue(createMockWorldState("connected"))
		expect(useWorldConnection()).toBe("connected")

		mockUseWorld.mockReturnValue(createMockWorldState("disconnected"))
		expect(useWorldConnection()).toBe("disconnected")

		mockUseWorld.mockReturnValue(createMockWorldState("error"))
		expect(useWorldConnection()).toBe("error")
	})
})
