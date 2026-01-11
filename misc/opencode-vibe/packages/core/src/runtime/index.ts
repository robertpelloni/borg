/**
 * @opencode-vibe/core/runtime - Effect runtime infrastructure
 *
 * Provides the foundational Effect runtime for ADR-016 Core Layer Responsibility Model.
 * This is the promise boundary between Effect services and non-Effect consumers.
 *
 * ## Key Exports
 *
 * - `runWithRuntime` - Promise boundary for executing Effects with AppLayer
 * - `AppLayer` - Composed layer of all core services
 * - `ConfigService` - Environment configuration service
 *
 * ## Usage
 *
 * ```typescript
 * import { runWithRuntime, ConfigService } from "@opencode-vibe/core/runtime"
 * import { Effect } from "effect"
 *
 * // In React component or API route
 * const nodeEnv = await runWithRuntime(
 *   Effect.gen(function* () {
 *     const config = yield* ConfigService
 *     return config.nodeEnv
 *   })
 * )
 * ```
 */

export { runWithRuntime } from "./run-with-runtime.js"
export { AppLayer, ConfigService } from "./app-layer.js"
