/**
 * useCommands - Hook for slash command registry
 *
 * Returns builtin and custom slash commands.
 * Builtin commands are hardcoded, custom commands fetched from API.
 *
 * @param options.directory - Project directory for server discovery (uses discovered server, not hardcoded URL)
 *
 * @returns {
 *   commands: SlashCommand[] - all commands (builtin + custom)
 *   getSlashCommands: () => SlashCommand[] - filter to commands with triggers
 *   findCommand: (trigger: string) => SlashCommand | undefined - find by trigger
 *   loading: boolean - true while fetching custom commands
 *   error: Error | null - error from API fetch (null if no error)
 * }
 *
 * @example
 * ```tsx
 * const { commands, findCommand, loading, error } = useCommands({ directory })
 *
 * if (loading) return <Spinner />
 * if (error) console.warn("Failed to load custom commands:", error)
 *
 * const newCmd = findCommand("new") // Find /new command
 * ```
 */

import { useMemo, useCallback, useState, useEffect } from "react"
import { commands as commandsApi } from "@opencode-vibe/core/api"
import type { SlashCommand } from "../types/prompt"

/**
 * Options for useCommands hook
 */
export interface UseCommandsOptions {
	/** Project directory for server discovery */
	directory?: string
}

/**
 * Builtin slash commands
 */
const BUILTIN_COMMANDS: SlashCommand[] = [
	{
		id: "session.new",
		trigger: "new",
		title: "New Session",
		keybind: "mod+n",
		type: "builtin",
	},
	{
		id: "session.share",
		trigger: "share",
		title: "Share Session",
		keybind: "mod+shift+s",
		type: "builtin",
	},
	{
		id: "session.compact",
		trigger: "compact",
		title: "Compact Context",
		type: "builtin",
	},
]

/**
 * useCommands hook
 *
 * Uses Promise API from @opencode-vibe/core/api to fetch custom commands.
 * Pass directory option to use server discovery instead of hardcoded URL.
 */
export function useCommands(options: UseCommandsOptions = {}) {
	const { directory } = options

	// Fetch custom commands from API using discovered server
	const [apiCommands, setApiCommands] = useState<Array<{ name: string; description?: string }>>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		let cancelled = false

		async function fetchCommands() {
			if (!directory) {
				setLoading(false)
				return
			}

			try {
				setLoading(true)
				const commands = await commandsApi.list(directory)
				if (!cancelled) {
					setApiCommands(commands)
					setError(null)
				}
			} catch (err) {
				if (!cancelled) {
					const error = err instanceof Error ? err : new Error(String(err))
					setError(error)
					console.error("Failed to fetch custom commands:", error)
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		fetchCommands()

		return () => {
			cancelled = true
		}
	}, [directory])

	// Map API response to SlashCommand format
	const customCommands = useMemo(
		() =>
			apiCommands.map((cmd) => ({
				id: `custom.${cmd.name}`,
				trigger: cmd.name,
				title: cmd.name,
				description: cmd.description,
				type: "custom" as const,
			})),
		[apiCommands],
	)

	// Combine builtin + custom
	const allCommands = useMemo(() => [...BUILTIN_COMMANDS, ...customCommands], [customCommands])

	/**
	 * Get all slash commands (commands with triggers)
	 * Currently all commands have triggers, but this filters for safety
	 */
	const getSlashCommands = useCallback(() => {
		return allCommands.filter((cmd) => cmd.trigger)
	}, [allCommands])

	/**
	 * Find command by trigger string
	 * Case-sensitive match
	 */
	const findCommand = useCallback(
		(trigger: string) => {
			return allCommands.find((cmd) => cmd.trigger === trigger)
		},
		[allCommands],
	)

	return {
		commands: allCommands,
		getSlashCommands,
		findCommand,
		loading,
		error,
	}
}
