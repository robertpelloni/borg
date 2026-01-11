/**
 * PubSub - n+1 Subscriber Fan-Out with Backpressure
 *
 * Decouples event distribution from SSE connection logic. Uses Effect PubSub
 * for efficient fan-out to multiple subscribers (WorldStore, Logger, Metrics, etc.)
 * without blocking on slow consumers.
 *
 * Architecture:
 * - PubSub.bounded(32) provides backpressure at 32 queued messages
 * - Each subscriber gets independent Queue (slow subscriber doesn't block others)
 * - Subscribers run as background Fibers in Effect Scope for auto-cleanup
 * - Publisher (merged-stream) publishes once, all subscribers receive
 *
 * Pattern from Hivemind (mem-af0a57f4d40f2f5f):
 * - PubSub.bounded for backpressure control
 * - Effect.fork for background subscriber Fibers
 * - Effect.forever + Queue.take for subscriber loops
 * - Scope cleanup for automatic Fiber termination
 */

import { PubSub, Effect, Queue, Fiber, Scope } from "effect"
import type { SourceEvent } from "./event-source.js"

/**
 * WorldEvent type - events flowing through the PubSub
 * Same as SourceEvent for consistency with existing architecture
 */
export type WorldEvent = SourceEvent

/**
 * Subscriber function type
 * Receives events and performs side effects (store updates, logging, metrics)
 */
export type SubscriberFn = (event: WorldEvent) => Effect.Effect<void, never>

/**
 * WorldEventPubSub - Creates bounded PubSub with subscriber management
 *
 * Provides:
 * - publish(): Emit events to all subscribers
 * - subscribe(): Register new subscriber (gets independent Queue)
 * - Automatic cleanup when Scope closes
 *
 * @example
 * ```typescript
 * import { Effect, Scope } from "effect"
 * import { createWorldEventPubSub } from "./pubsub.js"
 *
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* createWorldEventPubSub()
 *
 *   // Subscribe multiple consumers
 *   yield* pubsub.subscribe((event) =>
 *     Effect.sync(() => console.log("Logger:", event))
 *   )
 *   yield* pubsub.subscribe((event) =>
 *     Effect.sync(() => store.upsertSession(event.data))
 *   )
 *
 *   // Publish event (all subscribers receive)
 *   yield* pubsub.publish({
 *     source: "sse",
 *     type: "session.created",
 *     data: { id: "sess-1" },
 *     timestamp: Date.now()
 *   })
 * })
 *
 * // Run with Scope for auto-cleanup
 * Effect.runPromise(Effect.scoped(program))
 * ```
 */
export interface WorldEventPubSub {
	/**
	 * Publish event to all subscribers
	 * Blocks if all subscriber queues are full (backpressure)
	 */
	publish: (event: WorldEvent) => Effect.Effect<void, never>

	/**
	 * Subscribe to events with a handler function
	 * Returns Fiber handle for the subscriber (for testing/monitoring)
	 * Requires Scope for Fiber lifecycle management
	 */
	subscribe: (
		handler: SubscriberFn,
	) => Effect.Effect<Fiber.RuntimeFiber<never, never>, never, Scope.Scope>
}

/**
 * Create a bounded PubSub for WorldEvent distribution
 *
 * Creates PubSub.bounded(32) for backpressure control. Subscribers are
 * forked as background Fibers that run forever until Scope closes.
 *
 * **Backpressure**: When all queues fill to 32 messages, publish() blocks
 * until space is available. This prevents memory exhaustion with slow consumers.
 *
 * **Auto-cleanup**: Subscriber Fibers are attached to the Scope. When Scope
 * closes (e.g., stream.dispose()), all Fibers terminate automatically.
 *
 * @param capacity - Maximum messages per subscriber queue (default: 32)
 * @returns WorldEventPubSub instance scoped to current Effect
 *
 * @example
 * ```typescript
 * // In createMergedWorldStream:
 * const program = Effect.gen(function* () {
 *   const pubsub = yield* createWorldEventPubSub()
 *
 *   // Fork subscribers
 *   yield* pubsub.subscribe(storeSubscriber)
 *   yield* pubsub.subscribe(loggerSubscriber)
 *   yield* pubsub.subscribe(metricsSubscriber)
 *
 *   // Publish from stream
 *   yield* Stream.runForEach(mergedStream, (event) =>
 *     pubsub.publish(event)
 *   )
 * })
 * ```
 */
export function createWorldEventPubSub(
	capacity = 32,
): Effect.Effect<WorldEventPubSub, never, Scope.Scope> {
	return Effect.gen(function* () {
		// Create bounded PubSub (backpressure at `capacity` messages)
		const pubsub = yield* PubSub.bounded<WorldEvent>(capacity)

		return {
			/**
			 * Publish event to all subscribers
			 */
			publish: (event: WorldEvent) => PubSub.publish(pubsub, event),

			/**
			 * Subscribe with handler function
			 * Forks subscriber as background Fiber
			 */
			subscribe: (handler: SubscriberFn) =>
				Effect.gen(function* () {
					// Get independent queue for this subscriber
					const subscription = yield* PubSub.subscribe(pubsub)

					// Fork subscriber loop as background Fiber
					// Effect.forever runs until Fiber is interrupted (Scope cleanup)
					const fiber = yield* Effect.fork(
						Effect.forever(
							Effect.gen(function* () {
								// Block until message available
								const event = yield* Queue.take(subscription)

								// Handle event (store update, logging, metrics)
								// Errors are caught to prevent subscriber from crashing
								yield* Effect.catchAll(handler(event), () => Effect.void)
							}),
						),
					)

					return fiber
				}),
		}
	})
}
