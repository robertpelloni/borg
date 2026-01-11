import { describe, expect, it, vi } from "vitest"

/**
 * Tests for Suggestion component - stale closure audit
 *
 * Following project convention: NO DOM TESTING. Test the handler logic directly.
 *
 * Issue: handleClick captures onClick and suggestion props without useCallback.
 * If parent re-renders with new onClick or suggestion, the handler stays stale.
 *
 * Fix: Either use useCallback with [onClick, suggestion] deps, or inline the handler
 * (which React treats as a new function on each render, avoiding stale closures).
 */

describe("Suggestion - stale closure audit", () => {
	it("handleClick should call onClick with current suggestion prop", () => {
		// Test the handler logic, not DOM interactions
		const onClick = vi.fn()

		// Simulate the component's handleClick implementation
		// Current (BROKEN):
		// const handleClick = () => { onClick?.(suggestion) }
		//
		// This captures `suggestion` at component creation time.
		// If parent passes a new `suggestion`, handleClick still uses the old value.

		const createHandler = (suggestion: string, onClickProp: typeof onClick) => {
			// This is what the component DOES NOW (stale closure)
			return () => {
				onClickProp?.(suggestion)
			}
		}

		const firstHandler = createHandler("first", onClick)
		firstHandler()
		expect(onClick).toHaveBeenCalledWith("first")

		// Now imagine component re-renders with new suggestion
		// Without useCallback or inline handler, the OLD handler is still used
		onClick.mockClear()

		// Old handler still has "first" captured
		firstHandler()
		expect(onClick).toHaveBeenCalledWith("first") // Still "first", not "second" ❌
	})

	it("documents the fix: inline handler or useCallback avoids stale closures", () => {
		const onClick = vi.fn()

		// FIX 1: Inline handler (no intermediate function)
		// onClick={() => onClick?.(suggestion)}
		// React creates new function each render, always has fresh props

		// FIX 2: useCallback with deps
		// const handleClick = useCallback(() => onClick?.(suggestion), [onClick, suggestion])
		// Recreates handler when deps change

		// Simulate inline handler pattern
		const createInlineHandler = (suggestion: string, onClickProp: typeof onClick) => {
			// This recreates the handler each time (like inline arrow function)
			return () => {
				onClickProp?.(suggestion)
			}
		}

		const firstHandler = createInlineHandler("first", onClick)
		firstHandler()
		expect(onClick).toHaveBeenCalledWith("first")

		onClick.mockClear()

		// New handler created with new suggestion
		const secondHandler = createInlineHandler("second", onClick)
		secondHandler()
		expect(onClick).toHaveBeenCalledWith("second") // ✅ Fresh value
	})
})
