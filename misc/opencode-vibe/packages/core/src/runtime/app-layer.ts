/**
 * AppLayer - Core Effect runtime layer composition
 *
 * This is the foundational layer that provides all core services
 * for the opencode-next Effect runtime. Following the pattern from
 * semantic memory: Layer.mergeAll for composing service layers.
 *
 * Pattern: sync: () => ({...}) for simple services with no lifecycle
 * See: mem-5bef20787787b69d (Effect Service Factory Patterns)
 */

import { Effect, Layer } from "effect"
import { StatusService, MessageService, ContextService } from "../services/index.js"

/**
 * ConfigService - Simple configuration service
 *
 * Provides access to environment-based configuration.
 * Uses 'sync' factory pattern - no lifecycle management needed.
 */
export class ConfigService extends Effect.Service<ConfigService>()("ConfigService", {
	sync: () => ({
		nodeEnv: process.env.NODE_ENV || "development",
		isDevelopment: process.env.NODE_ENV !== "production",
		isProduction: process.env.NODE_ENV === "production",
	}),
}) {}

/**
 * AppLayer - Composed layer of all core services
 *
 * Currently includes:
 * - ConfigService: Environment configuration
 * - StatusService: Session status computation
 * - MessageService: Message-parts join operations
 * - ContextService: Context usage computation
 *
 * Future services will be added here as ADR-016 phases progress.
 */
export const AppLayer = Layer.mergeAll(
	ConfigService.Default,
	StatusService.Default,
	MessageService.Default,
	ContextService.Default,
)
