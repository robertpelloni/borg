/**
 * SSE EventSource Adapter
 *
 * Wraps MultiServerSSE (or any SSE implementation) as an EventSource
 * for integration with World Stream architecture.
 *
 * Pattern from Hivemind (mem-2a4f8a43a3632d5f):
 * - Stream.async for callback-based API conversion
 * - Monotonic sequence number generation
 * - Transform GlobalEvent → SourceEvent
 * - Cleanup via Effect.sync(() => unsubscribe())
 */

import { Effect, Stream, Metric } from "effect"
import type { EventSource, SourceEvent } from "./event-source.js"
import type { GlobalEvent } from "../types/events.js"
import { WorldMetrics } from "./metrics.js"

/**
 * SSE interface - duck-typed for testability
 * Matches MultiServerSSE public API
 */
interface SSE {
	start(): void
	stop(): void
	onEvent(callback: (event: GlobalEvent) => void): () => void
	isConnected(): boolean
}

/**
 * Create SSE EventSource adapter
 *
 * Wraps any SSE implementation (MultiServerSSE, WorldSSE, etc.) as an EventSource.
 * Converts callback-based SSE events to Effect Stream with normalized SourceEvent shape.
 *
 * **Pattern**: Stream.async with cleanup Effect (mem-2a4f8a43a3632d5f)
 * 1. Create/receive SSE instance
 * 2. Initialize sequence counter
 * 3. Subscribe with onEvent callback
 * 4. Transform GlobalEvent → SourceEvent
 * 5. Return cleanup Effect
 *
 * @param sse - SSE instance (MultiServerSSE, WorldSSE, or mock)
 *
 * @example
 * ```typescript
 * const sse = new MultiServerSSE()
 * sse.start()
 *
 * const source = createSseSource(sse)
 *
 * // Check availability
 * const isAvailable = await Effect.runPromise(source.available())
 *
 * // Stream events
 * const events = source.stream()
 * await Stream.runForEach(events, (event) =>
 *   Effect.sync(() => console.log(event))
 * )
 * ```
 */
export function createSseSource(sse: SSE): EventSource {
	return {
		name: "sse",

		/**
		 * Check if SSE is connected
		 */
		available: () =>
			Effect.gen(function* () {
				const isConnected = sse.isConnected()
				yield* Effect.logDebug("SSE source availability check").pipe(
					Effect.annotateLogs({ isConnected }),
				)
				return isConnected
			}),

		/**
		 * Stream events from SSE
		 *
		 * Uses Stream.async pattern from mem-2a4f8a43a3632d5f:
		 * - Subscribe to SSE events via onEvent callback
		 * - Transform GlobalEvent → SourceEvent
		 * - Track sequence numbers (monotonic offset)
		 * - Cleanup unsubscribes on stream end
		 */
		stream: () => {
			return Stream.async<SourceEvent, Error>((emit) => {
				// Initialize sequence counter for monotonic ordering
				let offset = 0

				// Log stream start
				Effect.runSync(
					Effect.logInfo("SSE source stream starting").pipe(Effect.annotateLogs({ source: "sse" })),
				)

				/**
				 * Subscribe to SSE events and transform to SourceEvent
				 */
				const unsubscribe = sse.onEvent((event: GlobalEvent) => {
					const transformEffect = Effect.withSpan("sse_source.transform", {
						attributes: { eventType: event.payload.type, directory: event.directory },
					})(
						Effect.gen(function* () {
							// Record event metric
							yield* Metric.update(
								WorldMetrics.sseEventsTotal.pipe(Metric.tagged("event_type", event.payload.type)),
								1,
							)

							// Transform GlobalEvent to SourceEvent
							const sourceEvent: SourceEvent = {
								source: "sse",
								type: event.payload.type,
								data: {
									directory: event.directory,
									properties: event.payload.properties,
								},
								timestamp: Date.now(),
								sequence: offset++,
							}

							emit.single(sourceEvent)
						}),
					)

					Effect.runSync(transformEffect)
				})

				/**
				 * Cleanup on stream end
				 * Returns Effect<void> as required by Stream.async
				 */
				return Effect.sync(() => {
					Effect.runSync(
						Effect.logInfo("SSE source stream stopped").pipe(
							Effect.annotateLogs({ source: "sse" }),
						),
					)
					unsubscribe()
					sse.stop()
				})
			})
		},
	}
}
