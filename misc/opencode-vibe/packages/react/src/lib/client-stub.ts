/**
 * Client stub for packages/react
 * This is a placeholder - actual client creation is app-specific
 */

export interface OpencodeClient {
	find: {
		files: (params: { query: { query: string; dirs: string } }) => Promise<{ data: string[] }>
	}
}

/**
 * Stub client creator
 * In app layer, this imports from @opencode/core
 */
export function createClient(_directory: string): OpencodeClient {
	throw new Error("createClient stub - should be provided by app layer")
}
