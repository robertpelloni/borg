import { describe, expect, it } from "vitest"
import { type ServerInfo, getServerForDirectory, getServerForSession } from "./server-routing.js"

const DEFAULT_SERVER_URL = "http://localhost:4056"

describe("getServerForDirectory", () => {
	const mockServers: ServerInfo[] = [
		{
			port: 4056,
			directory: "/home/user/project-a",
			url: "/api/opencode/4056",
		},
		{
			port: 4057,
			directory: "/home/user/project-b",
			url: "/api/opencode/4057",
		},
		{
			port: 4058,
			directory: "/home/user/project-a", // Duplicate directory
			url: "/api/opencode/4058",
		},
	]

	it("returns default when servers array is empty", () => {
		const result = getServerForDirectory("/any/directory", [])
		expect(result).toBe(DEFAULT_SERVER_URL)
	})

	it("returns default when no matching directory found", () => {
		const result = getServerForDirectory("/home/user/project-c", mockServers)
		expect(result).toBe(DEFAULT_SERVER_URL)
	})

	it("returns server URL for exact directory match", () => {
		const result = getServerForDirectory("/home/user/project-b", mockServers)
		expect(result).toBe("/api/opencode/4057")
	})

	it("returns first server when multiple servers for same directory", () => {
		const result = getServerForDirectory("/home/user/project-a", mockServers)
		// Should return the first matching server (port 4056)
		expect(result).toBe("/api/opencode/4056")
	})

	it("handles empty directory string", () => {
		const result = getServerForDirectory("", mockServers)
		expect(result).toBe(DEFAULT_SERVER_URL)
	})

	it("handles directory with trailing slash", () => {
		const serversWithTrailingSlash: ServerInfo[] = [
			{
				port: 4056,
				directory: "/home/user/project-a/",
				url: "/api/opencode/4056",
			},
		]

		// Query without trailing slash should still match
		const result1 = getServerForDirectory("/home/user/project-a", serversWithTrailingSlash)
		expect(result1).toBe("/api/opencode/4056")

		// Query with trailing slash should match directory without trailing slash
		const result2 = getServerForDirectory("/home/user/project-a/", mockServers)
		expect(result2).toBe("/api/opencode/4056")
	})

	it("is case-sensitive for directory matching", () => {
		const result = getServerForDirectory("/HOME/USER/PROJECT-A", mockServers)
		expect(result).toBe(DEFAULT_SERVER_URL)
	})
})

describe("getServerForSession", () => {
	const mockServers: ServerInfo[] = [
		{
			port: 4056,
			directory: "/home/user/project-a",
			url: "/api/opencode/4056",
		},
		{
			port: 4057,
			directory: "/home/user/project-b",
			url: "/api/opencode/4057",
		},
	]

	// Session-to-port cache simulating what MultiServerSSE tracks
	const sessionToPort = new Map<string, number>([
		["session-123", 4056],
		["session-456", 4057],
	])

	it("returns default when servers array is empty", () => {
		const result = getServerForSession("session-123", "/home/user/project-a", [], sessionToPort)
		expect(result).toBe(DEFAULT_SERVER_URL)
	})

	it("returns server for session when found in cache", () => {
		const result = getServerForSession(
			"session-123",
			"/home/user/project-a",
			mockServers,
			sessionToPort,
		)
		expect(result).toBe("/api/opencode/4056")
	})

	it("falls back to directory match when session not in cache", () => {
		const result = getServerForSession(
			"session-unknown",
			"/home/user/project-b",
			mockServers,
			sessionToPort,
		)
		expect(result).toBe("/api/opencode/4057")
	})

	it("returns default when neither session nor directory match", () => {
		const result = getServerForSession(
			"session-unknown",
			"/home/user/project-c",
			mockServers,
			sessionToPort,
		)
		expect(result).toBe(DEFAULT_SERVER_URL)
	})

	it("prefers session cache over directory match", () => {
		// session-456 is cached to port 4057, but we query with project-a directory
		const result = getServerForSession(
			"session-456",
			"/home/user/project-a",
			mockServers,
			sessionToPort,
		)
		// Should return the cached session port (4057), not directory match (4056)
		expect(result).toBe("/api/opencode/4057")
	})

	it("handles cached session for server that no longer exists", () => {
		const deadSessionCache = new Map<string, number>([
			["session-dead", 9999], // Port not in mockServers
		])

		const result = getServerForSession(
			"session-dead",
			"/home/user/project-a",
			mockServers,
			deadSessionCache,
		)
		// Should fall back to directory match since cached port doesn't exist
		expect(result).toBe("/api/opencode/4056")
	})

	it("works with empty session cache", () => {
		const result = getServerForSession(
			"session-123",
			"/home/user/project-a",
			mockServers,
			new Map(),
		)
		// Should fall back to directory match
		expect(result).toBe("/api/opencode/4056")
	})

	it("works with undefined session cache (optional parameter)", () => {
		const result = getServerForSession("session-123", "/home/user/project-a", mockServers)
		// Should fall back to directory match
		expect(result).toBe("/api/opencode/4056")
	})
})
