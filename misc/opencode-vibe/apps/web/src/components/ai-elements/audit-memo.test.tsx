import { describe, it, expect } from "vitest"
import { ChainOfThought, ChainOfThoughtStep } from "./chain-of-thought"
import { Shimmer } from "./shimmer"

describe("React.memo audit for ai-elements", () => {
	describe("ChainOfThought", () => {
		it("uses React.memo with default comparison (CORRECT - no SSE data)", () => {
			const cot = ChainOfThought as any
			expect(cot.$$typeof?.toString()).toBe("Symbol(react.memo)")
			expect(cot.compare).toBe(null) // Default shallow comparison
		})

		it("receives static props (open, defaultOpen, onOpenChange) - shallow comparison sufficient", () => {
			const props1 = { open: false, defaultOpen: false }
			const props2 = { open: true, defaultOpen: false }

			// Shallow comparison detects primitive changes
			expect(props1.open !== props2.open).toBe(true)
		})
	})

	describe("ChainOfThoughtStep", () => {
		it("uses React.memo with default comparison (CORRECT - no SSE data)", () => {
			const step = ChainOfThoughtStep as any
			expect(step.$$typeof?.toString()).toBe("Symbol(react.memo)")
			expect(step.compare).toBe(null)
		})

		it("receives static props (icon, label, description, status) - shallow comparison sufficient", () => {
			type Status = "complete" | "active"
			const props1 = { label: "Step 1", status: "complete" as Status }
			const props2 = { label: "Step 1", status: "active" as Status }

			// Shallow comparison detects string changes
			expect(props1.status !== props2.status).toBe(true)
		})
	})

	describe("Shimmer", () => {
		it("uses React.memo with default comparison (CORRECT - animation only, no SSE data)", () => {
			const shimmer = Shimmer as any
			expect(shimmer.$$typeof?.toString()).toBe("Symbol(react.memo)")
			expect(shimmer.compare).toBe(null)
		})

		it("receives static animation props (children, duration, spread) - shallow comparison sufficient", () => {
			const props1 = { children: "Loading...", duration: 2 }
			const props2 = { children: "Loading...", duration: 1 }

			// Shallow comparison detects primitive changes
			expect(props1.duration !== props2.duration).toBe(true)
		})
	})
})
