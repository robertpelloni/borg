#!/usr/bin/env bun

/**
 * Swarm CLI - Agent Control Plane
 *
 * Agent-friendly CLI for OpenCode swarm coordination.
 * Provides machine-readable output (NDJSON) and progressive discovery.
 *
 * Usage:
 *   swarm-cli <command> [options]
 *   swarm-cli --help
 */

import { commands, showHelp, parseGlobalOptions } from "./commands/index.js"
import { writeError } from "./output.js"

// Parse args
const args = process.argv.slice(2)

// Handle help
if (args.includes("--help") || args.includes("-h")) {
	showHelp()
	process.exit(0)
}

// Default to status if no command provided
if (args.length === 0 || (args.length === 1 && (args[0] === "--json" || args[0] === "--pretty"))) {
	args.unshift("status")
}

// Parse global options and get command
const { output, remainingArgs } = parseGlobalOptions(args)
const [commandName, ...commandArgs] = remainingArgs

// Validate command exists
if (!commandName) {
	writeError("No command specified")
	showHelp()
	process.exit(1)
}

const command = commands[commandName]
if (!command) {
	writeError(`Unknown command: ${commandName}`)
	console.error("\nAvailable commands:")
	for (const name of Object.keys(commands)) {
		console.error(`  ${name}`)
	}
	process.exit(1)
}

// Execute command
try {
	await command.run({
		args: commandArgs,
		output,
	})
} catch (error) {
	writeError("Command failed", {
		command: commandName,
		error: error instanceof Error ? error.message : String(error),
	})
	process.exit(1)
}
