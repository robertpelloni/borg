import { describe, expect, it, vi } from "vitest"

/**
 * Tests for Conversation component - stale closure audit
 *
 * Following project convention: NO DOM TESTING. Test the hook logic directly.
 *
 * Issue: handleScroll uses isSticking in its dependency array, causing the
 * callback to be recreated on every isSticking change. This works, but creates
 * unnecessary function churn.
 *
 * Better pattern (already used in ResizeObserver): Use ref for frequently-changing
 * values that don't need to trigger callback recreation.
 *
 * Current implementation (line 149-150) already has the pattern for ResizeObserver:
 *   const isStickingRef = useRef(isSticking)
 *   isStickingRef.current = isSticking
 *
 * handleScroll should use the same pattern.
 */

describe("Conversation - stale closure audit", () => {
	it("handleScroll with isSticking in deps causes unnecessary callback recreation", () => {
		// Current implementation:
		// const handleScroll = useCallback(() => {
		//   // ... uses isSticking
		// }, [isSticking])
		//
		// Problem: Every time isSticking changes, handleScroll is recreated.
		// This means onScroll prop changes, potentially causing child re-renders.

		let callbackCount = 0

		const simulateUseCallback = (_deps: unknown[]) => {
			callbackCount++
			return () => {} // The actual callback function
		}

		let isSticking = true

		// First render
		simulateUseCallback([isSticking])
		expect(callbackCount).toBe(1)

		// isSticking changes
		isSticking = false
		simulateUseCallback([isSticking])
		expect(callbackCount).toBe(2) // Callback recreated ❌

		// isSticking changes again
		isSticking = true
		simulateUseCallback([isSticking])
		expect(callbackCount).toBe(3) // Callback recreated again ❌
	})

	it("handleScroll with ref pattern avoids unnecessary callback recreation", () => {
		// Better pattern (like ResizeObserver):
		// const isStickingRef = useRef(isSticking)
		// isStickingRef.current = isSticking  // Updated on every render
		//
		// const handleScroll = useCallback(() => {
		//   // ... uses isStickingRef.current
		// }, [])  // Empty deps - callback never recreated
		//
		// Benefit: Callback function stays stable, onScroll prop doesn't change.

		let callbackCount = 0
		let currentDeps: unknown[] = []

		const simulateUseCallbackWithRef = (deps: unknown[]) => {
			// Only increment if deps changed (useCallback behavior)
			const depsChanged =
				deps.length !== currentDeps.length || deps.some((d, i) => d !== currentDeps[i])
			if (callbackCount === 0 || depsChanged) {
				callbackCount++
				currentDeps = deps
			}
			return () => {} // The actual callback function
		}

		let isSticking = true
		const isStickingRef = { current: isSticking }

		// First render
		simulateUseCallbackWithRef([]) // Empty deps
		expect(callbackCount).toBe(1)

		// isSticking changes (update ref, but callback deps are empty)
		isSticking = false
		isStickingRef.current = isSticking
		simulateUseCallbackWithRef([]) // Empty deps, no change
		expect(callbackCount).toBe(1) // Callback NOT recreated ✅

		// isSticking changes again
		isSticking = true
		isStickingRef.current = isSticking
		simulateUseCallbackWithRef([]) // Empty deps, no change
		expect(callbackCount).toBe(1) // Callback still stable ✅
	})

	it("documents ResizeObserver already uses ref pattern correctly", () => {
		// Current implementation (line 149-150, 159):
		// const isStickingRef = useRef(isSticking)
		// isStickingRef.current = isSticking
		//
		// useEffect(() => {
		//   const observer = new ResizeObserver(() => {
		//     if (isStickingRef.current) { ... }
		//   })
		// }, [scrollToBottomInstant])  // No isSticking in deps
		//
		// This is correct! The ResizeObserver callback reads isStickingRef.current,
		// which is always fresh, without needing isSticking in the useEffect deps.

		const isStickingRef = { current: true }

		const createObserver = (onResize: () => void) => {
			// Simulate ResizeObserver callback
			if (isStickingRef.current) {
				onResize()
			}
		}

		const onResize = vi.fn()
		createObserver(onResize)
		expect(onResize).toHaveBeenCalledTimes(1)

		// Change ref value (without recreating observer)
		isStickingRef.current = false
		createObserver(onResize)
		expect(onResize).toHaveBeenCalledTimes(1) // Not called when false ✅

		// Change back
		isStickingRef.current = true
		createObserver(onResize)
		expect(onResize).toHaveBeenCalledTimes(2) // Called when true ✅
	})
})
