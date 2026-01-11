/**
 * AtomRuntime - effect-atom runtime with API services
 *
 * Creates Atom.runtime with API service layers, enabling atoms to access
 * Effect services without exposing Effect types to React components.
 *
 * Pattern: Atom.runtime(Layer) provides service dependencies to atoms.
 * Atoms created with runtimeAtom.atom() can access services via Effect.gen.
 *
 * This follows the effect-atom pattern where:
 * 1. Services are defined with Effect.Service
 * 2. Services are composed into Layers
 * 3. Atom.runtime(Layer) creates a runtime that provides those services
 * 4. runtimeAtom.atom(Effect.gen(...)) creates atoms that can yield* services
 *
 * @module world/runtime
 */

import { Atom } from "@effect-atom/atom"
import { Layer } from "effect"
import { MessageService } from "../services/message-service.js"
import { StatusService } from "../services/status-service.js"

/**
 * Merged API Layer - provides all API services
 *
 * Combines:
 * - MessageService: message-parts join operations
 * - StatusService: session status computation
 *
 * Add new API services here when they're created.
 */
const ApiLayer = Layer.mergeAll(MessageService.Default, StatusService.Default)

/**
 * API Runtime Atom
 *
 * AtomRuntime that provides API services (MessageService, StatusService).
 * Use `apiRuntimeAtom.atom((get) => Effect.gen(...))` to create atoms that access services.
 *
 * The runtime automatically provides the services to atoms, so you can yield* them
 * in Effect.gen without manually providing layers.
 *
 * @example Basic usage with MessageService
 * ```typescript
 * import { apiRuntimeAtom, MessageService } from "@opencode/core/world/runtime"
 * import { Effect } from "effect"
 *
 * // Create an atom that uses MessageService
 * const messagesWithPartsAtom = apiRuntimeAtom.atom((get) =>
 *   Effect.gen(function* () {
 *     const service = yield* MessageService
 *     const messages = // ... fetch messages
 *     const parts = // ... fetch parts
 *     return service.listWithParts({ messages, parts })
 *   })
 * )
 * ```
 *
 * @example Composing multiple services
 * ```typescript
 * import { apiRuntimeAtom, MessageService, StatusService } from "@opencode/core/world/runtime"
 * import { Effect } from "effect"
 *
 * const sessionDataAtom = apiRuntimeAtom.atom((get) =>
 *   Effect.gen(function* () {
 *     const messageService = yield* MessageService
 *     const statusService = yield* StatusService
 *
 *     const messages = // ... fetch messages
 *     const parts = // ... fetch parts
 *     const messagesWithParts = messageService.listWithParts({ messages, parts })
 *
 *     const status = statusService.computeStatus({
 *       sessionId: "ses-123",
 *       sessionStatusMap: {},
 *       messages,
 *       parts: []
 *     })
 *
 *     return { messagesWithParts, status }
 *   })
 * )
 * ```
 *
 * Note: TypeScript may show type errors about Layer requirements when passing to Atom.runtime.
 * The 'as any' cast is safe because Atom.runtime handles the Layer internally.
 */
export const apiRuntimeAtom = Atom.runtime(ApiLayer as any)

/**
 * Export services for convenience
 *
 * Re-exports allow consumers to import everything from one place:
 * ```typescript
 * import { apiRuntimeAtom, MessageService, StatusService } from "@opencode/core/world/runtime"
 * ```
 */
export { MessageService, StatusService }
