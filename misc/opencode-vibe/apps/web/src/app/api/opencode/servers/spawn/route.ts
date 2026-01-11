/**
 * Spawn OpenCode Server API Route
 *
 * Spawns a headless opencode server for a given directory if none exists.
 * Uses `opencode serve` command to start the server in the background.
 *
 * POST /api/opencode/servers/spawn
 * Body: { directory: string }
 * Returns: { port: number; pid: number; directory: string } or { error: string }
 */

import { spawn } from "child_process"
import { NextResponse } from "next/server"

interface SpawnRequest {
	directory: string
}

interface DiscoveredServer {
	port: number
	pid: number
	directory: string
}

/**
 * Check if a server already exists for this directory
 */
async function findExistingServer(directory: string): Promise<DiscoveredServer | null> {
	try {
		const res = await fetch("http://127.0.0.1:8423/api/opencode/servers")
		if (!res.ok) return null

		const servers: DiscoveredServer[] = await res.json()
		return servers.find((s) => s.directory === directory) ?? null
	} catch {
		return null
	}
}

/**
 * Wait for server to be ready by polling /project/current
 */
async function waitForServer(
	port: number,
	directory: string,
	timeoutMs = 10000,
): Promise<DiscoveredServer | null> {
	const startTime = Date.now()
	const pollInterval = 200

	while (Date.now() - startTime < timeoutMs) {
		try {
			const res = await fetch(`http://127.0.0.1:${port}/project/current`, {
				signal: AbortSignal.timeout(500),
			})

			if (res.ok) {
				const project = await res.json()
				if (project.worktree === directory) {
					// Get PID from lsof
					const { exec } = await import("child_process")
					const { promisify } = await import("util")
					const execAsync = promisify(exec)

					try {
						const { stdout } = await execAsync(
							`lsof -iTCP:${port} -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR==2 {print $2}'`,
						)
						const pid = parseInt(stdout.trim(), 10) || 0

						return { port, pid, directory }
					} catch {
						return { port, pid: 0, directory }
					}
				}
			}
		} catch {
			// Server not ready yet
		}

		await new Promise((r) => setTimeout(r, pollInterval))
	}

	return null
}

/**
 * Find an available port
 */
async function findAvailablePort(): Promise<number> {
	const { createServer } = await import("net")

	return new Promise((resolve, reject) => {
		const server = createServer()
		server.listen(0, "127.0.0.1", () => {
			const address = server.address()
			if (address && typeof address === "object") {
				const port = address.port
				server.close(() => resolve(port))
			} else {
				server.close(() => reject(new Error("Could not get port")))
			}
		})
		server.on("error", reject)
	})
}

export async function POST(request: Request) {
	try {
		const body: SpawnRequest = await request.json()
		const { directory } = body

		if (!directory || typeof directory !== "string") {
			return NextResponse.json({ error: "directory is required" }, { status: 400 })
		}

		// Check if server already exists for this directory
		const existing = await findExistingServer(directory)
		if (existing) {
			return NextResponse.json(existing)
		}

		// Find an available port
		const port = await findAvailablePort()

		// Spawn opencode serve in the background
		const child = spawn("opencode", ["serve", "--port", String(port)], {
			cwd: directory,
			detached: true,
			stdio: "ignore",
			env: {
				...process.env,
				// Ensure it doesn't try to open a browser or TUI
				OPENCODE_HEADLESS: "1",
			},
		})

		// Detach the child process so it survives if this process exits
		child.unref()

		// Wait for server to be ready
		const server = await waitForServer(port, directory)

		if (!server) {
			// Try to kill the process if it didn't start properly
			try {
				process.kill(-child.pid!, "SIGTERM")
			} catch {
				// Ignore kill errors
			}

			return NextResponse.json({ error: "Server failed to start within timeout" }, { status: 500 })
		}

		return NextResponse.json(server)
	} catch (error) {
		console.error("[spawn-server] Error:", error)
		return NextResponse.json(
			{
				error: "Failed to spawn server",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		)
	}
}
