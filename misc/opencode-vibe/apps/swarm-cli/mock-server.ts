#!/usr/bin/env bun
/**
 * Mock OpenCode backend for testing world-viz CLI
 *
 * Provides:
 * - GET /session/list → Session[]
 * - GET /session/status → Record<sessionID, SessionStatus>
 * - SSE /events → GlobalEvent stream
 */

import type { Session } from "@opencode-vibe/core/types"
import type { SessionStatus } from "@opencode-vibe/core/types"

// Mock data - backend Session format (no status, messages, etc)
const mockSessions: Session[] = [
	{
		id: "session-1",
		title: "Implement authentication",
		directory: "/Users/joel/projects/my-app",
		time: {
			created: Date.now() - 3600000, // 1 hour ago
			updated: Date.now() - 60000, // 1 min ago
		},
	},
	{
		id: "session-2",
		title: "Fix type errors in auth module",
		directory: "/Users/joel/projects/my-app",
		time: {
			created: Date.now() - 7200000, // 2 hours ago
			updated: Date.now() - 1800000, // 30 min ago
		},
	},
	{
		id: "session-3",
		title: "Database migration",
		directory: "/Users/joel/projects/api-server",
		time: {
			created: Date.now() - 86400000, // 1 day ago
			updated: Date.now() - 43200000, // 12 hours ago
			archived: Date.now() - 3600000, // Archived 1 hour ago
		},
	},
]

// SessionStatus from backend perspective
const mockStatus: Record<string, any> = {
	"session-1": {
		status: "running",
		activeStream: true,
	},
	"session-2": {
		status: "idle",
	},
	"session-3": {
		status: "completed",
	},
}

// SSE clients
const sseClients = new Set<ReadableStreamDefaultController>()

// Simulate periodic updates
setInterval(() => {
	// Update session time
	if (mockSessions[0]) {
		mockSessions[0].time.updated = Date.now()
	}

	// Broadcast update event
	const event = {
		type: "session:updated",
		sessionId: "session-1",
		timestamp: Date.now(),
		session: mockSessions[0],
	}

	broadcastSSE(event)
}, 3000)

function broadcastSSE(event: any) {
	const data = `data: ${JSON.stringify(event)}\n\n`
	for (const controller of sseClients) {
		try {
			controller.enqueue(data)
		} catch {
			sseClients.delete(controller)
		}
	}
}

// Create HTTP server
const server = Bun.serve({
	port: 1999,
	async fetch(req) {
		const url = new URL(req.url)

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		}

		if (req.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders })
		}

		// Routes - support both /api/session/* and /session/*
		// GET /session returns session list
		if (
			url.pathname === "/session" ||
			url.pathname === "/session/list" ||
			url.pathname === "/api/session/list"
		) {
			console.log(`[${new Date().toLocaleTimeString()}] GET ${url.pathname}`)
			return Response.json(mockSessions, { headers: corsHeaders })
		}

		if (url.pathname === "/session/status" || url.pathname === "/api/session/status") {
			console.log(`[${new Date().toLocaleTimeString()}] GET ${url.pathname}`)
			return Response.json(mockStatus, { headers: corsHeaders })
		}

		if (url.pathname === "/events" || url.pathname === "/api/events") {
			// SSE endpoint
			const stream = new ReadableStream({
				start(controller) {
					sseClients.add(controller)

					// Send initial connection event
					controller.enqueue("data: " + JSON.stringify({ type: "connected" }) + "\n\n")

					// Cleanup on close
					req.signal.addEventListener("abort", () => {
						sseClients.delete(controller)
						controller.close()
					})
				},
			})

			return new Response(stream, {
				headers: {
					...corsHeaders,
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				},
			})
		}

		console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${url.pathname} - NOT FOUND`)
		return new Response("Not Found", { status: 404, headers: corsHeaders })
	},
})

console.log(`🚀 Mock OpenCode backend running on http://localhost:${server.port}`)
console.log(`   GET /session/list   - List sessions`)
console.log(`   GET /session/status - Session status`)
console.log(`   GET /events         - SSE event stream`)
console.log(`\nPress Ctrl+C to stop`)
