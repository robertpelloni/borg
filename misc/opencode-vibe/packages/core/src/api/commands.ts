/**
 * Commands API - Promise-based wrapper
 *
 * Promise-based API for slash command operations.
 * Wraps CommandAtom Effect programs with Effect.runPromise.
 *
 * @module api/commands
 */

import { Effect } from "effect"
import { CommandAtom, type CustomCommand } from "../atoms/commands.js"

/**
 * Commands API namespace
 *
 * Promise-based wrappers around CommandAtom.
 */
export const commands = {
	/**
	 * Fetch all custom commands
	 *
	 * @param directory - Project directory (optional)
	 * @returns Promise that resolves to CustomCommand array
	 *
	 * @example
	 * ```typescript
	 * const cmds = await commands.list()
	 * console.log(cmds.map(c => c.name))
	 * ```
	 */
	list: (directory?: string): Promise<CustomCommand[]> =>
		Effect.runPromise(CommandAtom.list(directory)),
}

// Export types for consumers
export type { CustomCommand }
