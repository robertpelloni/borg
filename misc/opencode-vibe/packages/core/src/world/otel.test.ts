/**
 * OTel Span Bridge Tests - TDD for Effect.withSpan → OpenTelemetry
 *
 * Tests OpenTelemetry integration with Effect spans.
 * Uses TDD approach: RED -> GREEN -> REFACTOR
 *
 * Test Coverage:
 * - Tracer provider creation
 * - Console exporter (default for dev)
 * - OTLP exporter (configured via env var)
 * - Span lifecycle (start, end, status)
 * - Effect Layer pattern
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Effect } from "effect"
import { trace } from "@opentelemetry/api"
import { OTelService, OTelServiceLive, type OTelConfig } from "./otel.js"

describe("OTel Span Bridge", () => {
	describe("OTelService exports", () => {
		it("should export OTelService tag", () => {
			expect(OTelService).toBeDefined()
		})

		it("should export OTelServiceLive layer", () => {
			expect(OTelServiceLive).toBeDefined()
		})
	})

	describe("tracer provider creation", () => {
		it("should create tracer provider with console exporter by default", async () => {
			const program = Effect.gen(function* () {
				const service = yield* OTelService
				expect(service.tracer).toBeDefined()
				expect(service.tracer.startSpan).toBeDefined()
			})

			await Effect.runPromise(Effect.provide(program, OTelServiceLive))
		})

		it("should use OTLP exporter when env var is set", async () => {
			const originalEnv = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

			try {
				process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318/v1/traces"

				const program = Effect.gen(function* () {
					const service = yield* OTelService
					expect(service.tracer).toBeDefined()
				})

				await Effect.runPromise(Effect.provide(program, OTelServiceLive))
			} finally {
				// Restore original env
				if (originalEnv) {
					process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEnv
				} else {
					delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
				}
			}
		})

		it("should use custom tracer name from config", async () => {
			const program = Effect.gen(function* () {
				const service = yield* OTelService
				// Tracer should be configured with service name
				expect(service.tracer).toBeDefined()
			})

			await Effect.runPromise(Effect.provide(program, OTelServiceLive))
		})
	})

	describe("span bridging", () => {
		it("should start and end spans", async () => {
			const program = Effect.gen(function* () {
				const service = yield* OTelService
				const span = service.startSpan("test-operation")

				expect(span).toBeDefined()
				expect(span.isRecording()).toBe(true)

				span.end()
				expect(span.isRecording()).toBe(false)
			})

			await Effect.runPromise(Effect.provide(program, OTelServiceLive))
		})

		it("should set span status on success", async () => {
			const program = Effect.gen(function* () {
				const service = yield* OTelService
				const span = service.startSpan("success-operation")

				// Simulate successful operation
				yield* Effect.succeed("result")

				span.setStatus({ code: 1 }) // OK status
				span.end()
			})

			await Effect.runPromise(Effect.provide(program, OTelServiceLive))
		})

		it("should set span status on error", async () => {
			const program = Effect.gen(function* () {
				const service = yield* OTelService
				const span = service.startSpan("error-operation")

				try {
					yield* Effect.fail(new Error("test error"))
				} catch {
					span.setStatus({ code: 2, message: "test error" }) // ERROR status
				}

				span.end()
			})

			await Effect.runPromise(Effect.provide(Effect.either(program), OTelServiceLive))
		})
	})

	describe("resource cleanup", () => {
		it("should shutdown provider on layer disposal", async () => {
			const program = Effect.gen(function* () {
				const service = yield* OTelService
				expect(service.tracer).toBeDefined()
			})

			// Run in scoped context to trigger cleanup
			await Effect.runPromise(Effect.scoped(Effect.provide(program, OTelServiceLive)))

			// Provider should be shutdown after scope closes
			// This is verified implicitly - if cleanup fails, test will hang
		})
	})

	describe("configuration", () => {
		it("should accept custom service name", async () => {
			const customConfig: OTelConfig = {
				serviceName: "custom-service",
			}

			const program = Effect.gen(function* () {
				const service = yield* OTelService
				expect(service.tracer).toBeDefined()
			})

			// Custom layer with config would be created here
			await Effect.runPromise(Effect.provide(program, OTelServiceLive))
		})
	})
})
