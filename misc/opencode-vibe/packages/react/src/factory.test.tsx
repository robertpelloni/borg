/**
 * Tests for generateOpencodeHelpers factory
 *
 * Focus: Prevent infinite loop regressions from unstable references
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { generateOpencodeHelpers } from "./factory"
import { useOpencodeStore } from "./store"
import type { OpencodeConfig } from "./next-ssr-plugin"

const TEST_CONFIG: OpencodeConfig = {
	baseUrl: "/api/opencode/4056",
	directory: "/test/dir",
}

describe("factory hooks - stable references", () => {
	beforeEach(() => {
		// Reset store between tests
		useOpencodeStore.setState({
			directories: {},
		})
	})

	it("useMessages returns stable empty array when no messages", () => {
		const { useMessages } = generateOpencodeHelpers(TEST_CONFIG)

		// Initialize directory with empty messages
		useOpencodeStore.getState().initDirectory(TEST_CONFIG.directory)

		const { result, rerender } = renderHook(() => useMessages("ses_123"))

		const firstResult = result.current
		expect(firstResult).toEqual([])

		// Re-render should return SAME reference (not new array)
		rerender()
		const secondResult = result.current
		expect(secondResult).toBe(firstResult) // Same reference
	})

	it("useSessionList returns stable empty array when no sessions", () => {
		const { useSessionList } = generateOpencodeHelpers(TEST_CONFIG)

		// Initialize directory
		useOpencodeStore.getState().initDirectory(TEST_CONFIG.directory)

		const { result, rerender } = renderHook(() => useSessionList())

		const firstResult = result.current
		expect(firstResult).toEqual([])

		// Re-render should return SAME reference
		rerender()
		const secondResult = result.current
		expect(secondResult).toBe(firstResult)
	})

	it("useCompactionState returns stable default object", () => {
		const { useCompactionState } = generateOpencodeHelpers(TEST_CONFIG)

		// Initialize directory
		useOpencodeStore.getState().initDirectory(TEST_CONFIG.directory)

		const { result, rerender } = renderHook(() => useCompactionState("ses_123"))

		const firstResult = result.current
		expect(firstResult.isCompacting).toBe(false)

		// Re-render should return SAME object reference
		rerender()
		const secondResult = result.current
		expect(secondResult).toBe(firstResult)
	})

	it("useContextUsage returns stable default object", () => {
		const { useContextUsage } = generateOpencodeHelpers(TEST_CONFIG)

		// Initialize directory
		useOpencodeStore.getState().initDirectory(TEST_CONFIG.directory)

		const { result, rerender } = renderHook(() => useContextUsage("ses_123"))

		const firstResult = result.current
		expect(firstResult.used).toBe(0)

		// Re-render should return SAME object reference
		rerender()
		const secondResult = result.current
		expect(secondResult).toBe(firstResult)
	})

	it("useSessionList filters archived sessions and returns stable array", () => {
		const { useSessionList } = generateOpencodeHelpers(TEST_CONFIG)

		// Initialize directory with sessions
		useOpencodeStore.getState().initDirectory(TEST_CONFIG.directory)
		useOpencodeStore.getState().setSessions(TEST_CONFIG.directory, [
			{
				id: "ses_1",
				title: "Active",
				time: { created: 0, updated: 0, archived: undefined },
			} as any,
			{
				id: "ses_2",
				title: "Archived",
				time: { created: 0, updated: 0, archived: 123 },
			} as any,
		])

		const { result, rerender } = renderHook(() => useSessionList())

		const firstResult = result.current
		expect(firstResult).toHaveLength(1)
		expect(firstResult[0].id).toBe("ses_1")

		// Re-render without store changes should return SAME array reference
		rerender()
		const secondResult = result.current
		expect(secondResult).toBe(firstResult)
	})

	it("hooks don't cause infinite loops when used together", () => {
		const { useSession, useMessages, useSessionStatus, useCompactionState, useContextUsage } =
			generateOpencodeHelpers(TEST_CONFIG)

		// Initialize directory
		useOpencodeStore.getState().initDirectory(TEST_CONFIG.directory)
		useOpencodeStore.getState().setSessions(TEST_CONFIG.directory, [
			{
				id: "ses_123",
				title: "Test",
				time: { created: 0, updated: 0 },
			} as any,
		])

		let renderCount = 0
		const { rerender } = renderHook(() => {
			renderCount++
			// Use all hooks that had infinite loop bugs
			useSession("ses_123")
			useMessages("ses_123")
			useSessionStatus("ses_123")
			useCompactionState("ses_123")
			useContextUsage("ses_123")
		})

		expect(renderCount).toBe(1)

		// Multiple re-renders should not trigger cascading re-renders
		rerender()
		rerender()
		rerender()

		expect(renderCount).toBe(4) // 1 initial + 3 explicit rerenders (no extras)
	})
})
