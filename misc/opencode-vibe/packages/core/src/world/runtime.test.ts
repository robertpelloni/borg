/**
 * Runtime Tests - TDD for Atom.runtime integration
 *
 * Tests AtomRuntime creation with API service layers.
 * Uses TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect } from "vitest"
import { apiRuntimeAtom, MessageService, StatusService } from "./runtime.js"

describe("AtomRuntime", () => {
	describe("apiRuntimeAtom exports", () => {
		it("should export apiRuntimeAtom with atom factory", () => {
			expect(apiRuntimeAtom).toBeDefined()
			expect(apiRuntimeAtom.atom).toBeDefined()
			expect(typeof apiRuntimeAtom.atom).toBe("function")
		})

		it("should export MessageService", () => {
			expect(MessageService).toBeDefined()
			expect(MessageService.Default).toBeDefined()
		})

		it("should export StatusService", () => {
			expect(StatusService).toBeDefined()
			expect(StatusService.Default).toBeDefined()
		})

		it("should have layer property on runtime", () => {
			expect(apiRuntimeAtom.layer).toBeDefined()
		})

		it("should have factory property on runtime", () => {
			expect(apiRuntimeAtom.factory).toBeDefined()
		})
	})

	describe("runtime pattern documentation", () => {
		it("demonstrates the expected usage pattern", () => {
			// This test documents how apiRuntimeAtom should be used
			// The actual functionality will be tested in integration tests
			// when atoms are used with React hooks

			// Pattern 1: Create an atom with service access
			// const myAtom = apiRuntimeAtom.atom((get) =>
			//   Effect.gen(function* () {
			//     const service = yield* MessageService
			//     return service.listWithParts({ messages, parts })
			//   })
			// )

			// Pattern 2: Multiple services
			// const composedAtom = apiRuntimeAtom.atom((get) =>
			//   Effect.gen(function* () {
			//     const messageService = yield* MessageService
			//     const statusService = yield* StatusService
			//     return { messageService, statusService }
			//   })
			// )

			// This test just verifies the exports exist
			expect(apiRuntimeAtom.atom).toBeDefined()
			expect(MessageService).toBeDefined()
			expect(StatusService).toBeDefined()
		})
	})
})
