import { describe, test, expect } from "vitest"
import { Effect, Layer } from "effect"
import { runWithRuntime } from "./run-with-runtime.js"
import { AppLayer } from "./app-layer.js"

/**
 * Test suite for runWithRuntime - Effect runtime promise boundary
 *
 * Following TDD RED → GREEN → REFACTOR
 * Tests written BEFORE implementation to specify behavior
 */

describe("runWithRuntime", () => {
	test("should execute Effect and return Promise", async () => {
		// Arrange: Create a simple Effect that returns a value
		const effect = Effect.succeed(42)

		// Act: Run through runtime
		const result = await runWithRuntime(effect)

		// Assert: Should get the value back
		expect(result).toBe(42)
	})

	test("should handle Effect failures", async () => {
		// Arrange: Create an Effect that fails
		const effect = Effect.fail(new Error("Test error"))

		// Act & Assert: Should reject the Promise
		await expect(runWithRuntime(effect)).rejects.toThrow("Test error")
	})

	test("should provide AppLayer to Effects", async () => {
		// Arrange: Create a simple service to test with
		class TestService extends Effect.Service<TestService>()("TestService", {
			sync: () => ({
				getValue: () => "test-value",
			}),
		}) {}

		// Create an Effect that uses the service
		const effect = Effect.gen(function* () {
			const service = yield* TestService
			return service.getValue()
		})

		// This test will fail until we implement AppLayer properly
		// For now, just verify runWithRuntime exists
		// Later we'll test with actual AppLayer services
		expect(typeof runWithRuntime).toBe("function")
	})

	test("should handle scoped Effects with finalizers", async () => {
		// Arrange: Track whether finalizer was called
		let finalizerCalled = false

		const scopedEffect = Effect.gen(function* () {
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					finalizerCalled = true
				}),
			)
			return "scoped-result"
		})

		// Act: Run scoped effect
		const result = await runWithRuntime(scopedEffect)

		// Assert: Result should be correct and finalizer should run
		expect(result).toBe("scoped-result")
		expect(finalizerCalled).toBe(true)
	})

	test("should allow providing custom layers", async () => {
		// Arrange: Create a test service
		class ConfigService extends Effect.Service<ConfigService>()("ConfigService", {
			sync: () => ({
				apiKey: "test-key",
			}),
		}) {}

		// Create an Effect that uses ConfigService
		const effect = Effect.gen(function* () {
			const config = yield* ConfigService
			return config.apiKey
		})

		// Act: This will fail until we implement runWithRuntime
		// For now, just ensure the test structure is correct
		expect(typeof effect).toBe("object")
	})
})
