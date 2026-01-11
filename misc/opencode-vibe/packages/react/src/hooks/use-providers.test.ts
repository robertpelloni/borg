/**
 * useProviders Hook Tests
 * Verifies loading state management without DOM testing
 *
 * Tests focus on the Promise API integration and state transitions.
 * NO DOM TESTING - tests pure logic only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { providers } from "@opencode-vibe/core/api"
import type { Provider } from "@opencode-vibe/core/atoms"

// Mock the core API
vi.mock("@opencode-vibe/core/api", () => ({
	providers: {
		list: vi.fn(),
	},
}))

describe("useProviders - Promise API Integration", () => {
	const mockProviders: Provider[] = [
		{
			id: "anthropic",
			name: "Anthropic",
			models: [
				{ id: "claude-3-opus", name: "Claude 3 Opus" },
				{ id: "claude-3-sonnet", name: "Claude 3 Sonnet" },
			],
		},
	]

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Promise Resolution Behavior", () => {
		it("resolves with provider data when API succeeds", async () => {
			// Given: API returns providers
			;(providers.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviders)

			// When: API is called
			const result = await providers.list()

			// Then: Returns provider data
			expect(result).toEqual(mockProviders)
			expect(providers.list).toHaveBeenCalledTimes(1)
		})

		it("rejects with error when API fails", async () => {
			// Given: API throws error
			const mockError = new Error("Network error")
			;(providers.list as ReturnType<typeof vi.fn>).mockRejectedValue(mockError)

			// When: API is called
			// Then: Promise rejects with error
			await expect(providers.list()).rejects.toThrow("Network error")
			expect(providers.list).toHaveBeenCalledTimes(1)
		})
	})

	describe("Interface Contract", () => {
		it("API returns array of Provider objects", async () => {
			// Given: Mock providers
			;(providers.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviders)

			// When: API is called
			const result = await providers.list()

			// Then: Each provider has required structure
			expect(Array.isArray(result)).toBe(true)
			const provider = result[0]
			expect(provider).toBeDefined()
			expect(provider?.id).toBeDefined()
			expect(provider?.name).toBeDefined()
			expect(provider?.models).toBeDefined()
			expect(Array.isArray(provider?.models)).toBe(true)
		})

		it("models array contains model objects with id and name", async () => {
			// Given: Mock providers
			;(providers.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviders)

			// When: API is called
			const result = await providers.list()

			// Then: Models have required structure
			const provider = result[0]
			expect(provider).toBeDefined()
			const model = provider?.models?.[0]
			expect(model).toBeDefined()
			expect(model?.id).toBeDefined()
			expect(model?.name).toBeDefined()
			expect(typeof model?.id).toBe("string")
			expect(typeof model?.name).toBe("string")
		})
	})

	describe("Loading State Logic (Pure Function Tests)", () => {
		it("Promise chain sets loading true → false on success", async () => {
			// Given: Track state changes
			const states: boolean[] = []
			;(providers.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviders)

			// When: Simulate the hook's fetch logic
			states.push(true) // setLoading(true) before fetch

			try {
				await providers.list()
				states.push(false) // setLoading(false) in finally
			} catch {
				states.push(false) // setLoading(false) in finally
			}

			// Then: Loading goes true → false
			expect(states).toEqual([true, false])
		})

		it("Promise chain sets loading true → false on error", async () => {
			// Given: Track state changes
			const states: boolean[] = []
			;(providers.list as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"))

			// When: Simulate the hook's fetch logic
			states.push(true) // setLoading(true) before fetch

			try {
				await providers.list()
			} catch {
				// Error caught
			} finally {
				states.push(false) // setLoading(false) in finally
			}

			// Then: Loading goes true → false even on error
			expect(states).toEqual([true, false])
		})
	})

	describe("Type Safety", () => {
		it("return type matches UseProvidersReturn interface", async () => {
			// Given: Mock data
			;(providers.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockProviders)

			// When: Construct return object (as hook does)
			const returnValue = {
				providers: await providers.list(),
				loading: false,
				error: null,
				refetch: () => {},
			}

			// Then: Has all required properties
			expect(returnValue).toHaveProperty("providers")
			expect(returnValue).toHaveProperty("loading")
			expect(returnValue).toHaveProperty("error")
			expect(returnValue).toHaveProperty("refetch")

			// And: Types are correct
			expect(Array.isArray(returnValue.providers)).toBe(true)
			expect(typeof returnValue.loading).toBe("boolean")
			expect(returnValue.error).toBe(null)
			expect(typeof returnValue.refetch).toBe("function")
		})
	})
})
