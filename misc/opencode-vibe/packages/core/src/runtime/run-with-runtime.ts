/**
 * runWithRuntime - Promise boundary for Effect runtime
 *
 * This is the standard pattern for exposing Effect services to non-Effect
 * consumers (React components, API routes, etc.). It provides the AppLayer
 * and converts Effect to Promise.
 *
 * Pattern from semantic memory (mem-eb60fc36630619f1):
 * "The standard way to expose Effect services to non-Effect consumers
 * is through a runWithRuntime helper that provides the runtime and
 * converts to Promise."
 *
 * Key characteristics:
 * - Automatically provides AppLayer
 * - Handles scoped Effects (with finalizers)
 * - Type-safe promise boundary
 * - Single source of truth for runtime configuration
 */

import { Effect } from "effect"
import { AppLayer } from "./app-layer.js"

/**
 * Run an Effect with the application runtime and convert to Promise
 *
 * This function:
 * 1. Provides AppLayer (makes all services available)
 * 2. Handles scoped effects (runs finalizers)
 * 3. Converts Effect to Promise for non-Effect code
 *
 * @example
 * ```typescript
 * // In a React component or API route
 * const result = await runWithRuntime(
 *   Effect.gen(function* () {
 *     const config = yield* ConfigService
 *     return config.nodeEnv
 *   })
 * )
 * ```
 *
 * @param effect - The Effect to execute
 * @returns Promise that resolves with the Effect's success value or rejects with its error
 */
export const runWithRuntime = <A, E>(effect: Effect.Effect<A, E, any>): Promise<A> => {
	// Provide the application layer (dependency injection)
	const withRuntime = Effect.provide(effect, AppLayer)
	// Handle scoped effects (run finalizers) and convert to Promise
	// After providing AppLayer, no requirements remain (never)
	return Effect.runPromise(Effect.scoped(withRuntime as Effect.Effect<A, E, never>))
}
