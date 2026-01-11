/**
 * @opencode-vibe/core/client
 *
 * Client routing utilities and SDK factory for OpenCode
 *
 * Provides routing logic and SDK client factory.
 */

export {
	getClientUrl,
	OPENCODE_URL,
	createClient,
	globalClient,
	createClientSSR,
	globalClientSSR,
	type RoutingContext,
	type OpencodeClient,
} from "./client.js"
