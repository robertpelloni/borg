/**
 * Provider Atoms
 *
 * Pure Effect programs for AI provider management.
 * Framework-agnostic - no React dependencies.
 *
 * Provides:
 * - Provider list fetching as Effect program
 * - Model enumeration per provider
 * - Type-safe transformations
 *
 * @module atoms/providers
 */

import { Effect } from "effect"
import { globalClient } from "../client/index.js"

/**
 * AI model information
 */
export interface Model {
	id: string
	name: string
}

/**
 * AI provider with available models
 */
export interface Provider {
	id: string
	name: string
	models: Model[]
}

/**
 * Transform SDK provider response (models as dictionary) to our interface (models as array)
 *
 * SDK format: { models: { [key: string]: { name: string } } }
 * Our format: { models: Model[] }
 *
 * @param rawProvider - Provider from SDK with models as dictionary
 * @returns Provider with models as array
 */
function transformProvider(rawProvider: any): Provider {
	return {
		id: rawProvider.id,
		name: rawProvider.name,
		models: rawProvider.models
			? Object.entries(rawProvider.models).map(([id, model]: [string, any]) => ({
					id,
					name: model.name || id,
				}))
			: [],
	}
}

/**
 * Provider atom namespace
 *
 * Pure Effect programs for provider operations.
 * Use with Effect.runPromise in React hooks.
 */
export const ProviderAtom = {
	/**
	 * Fetch all AI providers with their models
	 *
	 * @returns Effect program yielding Provider array
	 *
	 * @example
	 * ```typescript
	 * // In React hook:
	 * Effect.runPromise(ProviderAtom.list())
	 *   .then(providers => setState({ providers, loading: false }))
	 *   .catch(error => setState({ error, loading: false }))
	 * ```
	 */
	list: (): Effect.Effect<Provider[], Error> =>
		Effect.gen(function* () {
			const client = yield* Effect.sync(() => globalClient)

			const result = yield* Effect.tryPromise({
				try: (_signal) => client.provider.list(),
				catch: (e) => new Error(`Failed to fetch providers: ${e}`),
			})

			// Transform SDK response
			// SDK returns: { all: Provider[], default: Provider, connected: string[] }
			const rawProviders = result.data?.all ?? []
			return rawProviders.map(transformProvider)
		}),
}
