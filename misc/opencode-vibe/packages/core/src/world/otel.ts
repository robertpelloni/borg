/**
 * OpenTelemetry Span Bridge - Effect Layer Integration
 *
 * Bridges Effect.withSpan to OpenTelemetry SDK for distributed tracing.
 * Pattern: Effect Layer wrapping OTel TracerProvider with configurable exporters.
 *
 * Architecture:
 * - Console exporter for dev (default)
 * - OTLP exporter for prod (via OTEL_EXPORTER_OTLP_ENDPOINT env var)
 * - Effect.acquireRelease for proper tracer provider shutdown
 * - Scoped Layer for automatic cleanup
 *
 * Usage:
 * ```typescript
 * import { Effect } from "effect"
 * import { OTelService, OTelServiceLive } from "./otel.js"
 *
 * const program = Effect.gen(function* () {
 *   const otel = yield* OTelService
 *   const span = otel.startSpan("my-operation")
 *
 *   // Do work...
 *   span.setStatus({ code: 1 }) // OK
 *   span.end()
 * })
 *
 * // Run with OTel layer
 * Effect.runPromise(Effect.provide(program, OTelServiceLive))
 * ```
 *
 * Pattern from Hivemind (mem-987a7f6973f3c8ab):
 * - NodeTracerProvider for Node.js environments
 * - SimpleSpanProcessor for synchronous export (dev)
 * - ConsoleSpanExporter (default) or OTLPTraceExporter (prod)
 * - Effect.acquireRelease for tracer provider lifecycle
 */

import { Effect, Layer, Context } from "effect"
import { trace, type Tracer, type Span } from "@opentelemetry/api"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"

/**
 * OTel configuration
 */
export interface OTelConfig {
	/** Service name for tracer (default: "opencode-vibe") */
	serviceName?: string
	/** Custom exporter endpoint (overrides env var) */
	exporterEndpoint?: string
}

/**
 * OTelService - Effect service providing OpenTelemetry tracer
 *
 * Provides:
 * - tracer: OpenTelemetry Tracer instance
 * - startSpan: Convenience method for starting spans
 */
export class OTelService extends Context.Tag("OTelService")<
	OTelService,
	{
		tracer: Tracer
		startSpan: (name: string) => Span
	}
>() {}

/**
 * Create OTel Layer with optional configuration
 *
 * @param config - Optional OTel configuration
 * @returns Effect Layer providing OTelService
 */
export function makeOTelServiceLive(config: OTelConfig = {}): Layer.Layer<OTelService, never> {
	return Layer.scoped(
		OTelService,
		Effect.gen(function* () {
			const serviceName = config.serviceName ?? "opencode-vibe"

			// Determine exporter: OTLP (env var or config) or Console (default)
			const exporterEndpoint = config.exporterEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT

			const exporter = exporterEndpoint
				? new OTLPTraceExporter({ url: exporterEndpoint })
				: new ConsoleSpanExporter()

			// Create tracer provider with span processor configured
			const provider = new NodeTracerProvider({
				spanProcessors: [new SimpleSpanProcessor(exporter)],
			})

			// Register global tracer provider
			provider.register()

			// Acquire/Release pattern for tracer provider lifecycle
			yield* Effect.addFinalizer(() =>
				Effect.promise(() =>
					provider.shutdown().then(
						() => {},
						() => {},
					),
				),
			)

			// Get tracer instance
			const tracer = trace.getTracer(serviceName)

			return {
				tracer,
				startSpan: (name: string) => tracer.startSpan(name),
			}
		}),
	)
}

/**
 * Default OTelService Layer
 *
 * Uses console exporter by default, OTLP if OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Service name: "opencode-vibe"
 */
export const OTelServiceLive: Layer.Layer<OTelService, never> = makeOTelServiceLive()
