/**
 * SSEService tests - Effect.Service pattern with Layer.scoped
 *
 * Tests verify the new SSEService provides the same functionality as WorldSSE
 * but with Effect-native lifecycle management (Layer.scoped + acquireRelease).
 */

import { describe, expect, it, beforeEach } from "vitest"
import { Effect, Layer } from "effect"
import { SSEService, SSEServiceLive } from "./sse.js"
import { Registry, connectionStatusAtom } from "./atoms.js"

describe("SSEService - Effect.Service Pattern", () => {
	let registry: Registry.Registry

	beforeEach(() => {
		registry = Registry.make()
	})

	it("provides SSEService via Layer", async () => {
		const program = Effect.gen(function* () {
			const service = yield* SSEService
			expect(service).toBeDefined()
			expect(service.start).toBeDefined()
			expect(service.stop).toBeDefined()
			expect(service.getConnectedPorts).toBeDefined()
		})

		await Effect.runPromise(program.pipe(Effect.provide(SSEServiceLive(registry))))
	})

	it("can start and stop SSE connections", async () => {
		const program = Effect.gen(function* () {
			const service = yield* SSEService

			// Start connections
			yield* service.start()

			// Verify registry status changed
			const statusAfterStart = registry.get(connectionStatusAtom)
			expect(statusAfterStart).toBe("connecting")

			// Stop connections
			yield* service.stop()

			// Verify cleanup
			const statusAfterStop = registry.get(connectionStatusAtom)
			expect(statusAfterStop).toBe("disconnected")
		})

		await Effect.runPromise(
			program.pipe(
				Effect.provide(SSEServiceLive(registry, { serverUrl: "http://localhost:9999" })),
			),
		)
	})

	it("auto-cleanup on scope exit (acquireRelease pattern)", async () => {
		const program = Effect.gen(function* () {
			const service = yield* SSEService
			yield* service.start()

			// Verify connecting
			const status = registry.get(connectionStatusAtom)
			expect(status).toBe("connecting")

			// Scope will auto-cleanup when program exits
		})

		await Effect.runPromise(
			program.pipe(
				Effect.provide(SSEServiceLive(registry, { serverUrl: "http://localhost:9999" })),
			),
		)

		// After scope exit, service should be cleaned up
		const finalStatus = registry.get(connectionStatusAtom)
		expect(finalStatus).toBe("disconnected")
	})

	it("getConnectedPorts returns Effect", async () => {
		const program = Effect.gen(function* () {
			const service = yield* SSEService
			yield* service.start()

			const ports = yield* service.getConnectedPorts()
			expect(Array.isArray(ports)).toBe(true)

			yield* service.stop()
		})

		await Effect.runPromise(
			program.pipe(
				Effect.provide(SSEServiceLive(registry, { serverUrl: "http://localhost:9999" })),
			),
		)
	})
})
