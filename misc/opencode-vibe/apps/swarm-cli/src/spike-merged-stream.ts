/**
 * Spike test for merged event streams
 *
 * Tests the merged stream implementation by combining:
 * 1. Mock SSE source (emits test events on interval)
 * 2. Real swarm.db source (if available)
 *
 * Validates that events from both sources flow correctly with source tags.
 */

import { Effect, Stream } from "effect"
import {
	createMergedWorldStream,
	createSwarmDbSource,
	type EventSource,
	type SourceEvent,
} from "@opencode-vibe/core/world"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Create a mock SSE event source for testing
 *
 * Emits heartbeat events every 500ms to simulate SSE behavior.
 */
function createMockSSESource(): EventSource {
	return {
		name: "mock-sse",

		// Always available
		available: () => Effect.succeed(true),

		// Stream heartbeat events on interval
		stream: () => {
			return Stream.async<SourceEvent, Error>((emit) => {
				let counter = 0

				const intervalId = setInterval(() => {
					counter++
					const event: SourceEvent = {
						source: "mock-sse",
						type: "heartbeat",
						data: {
							counter,
							timestamp: Date.now(),
							message: `Mock SSE heartbeat ${counter}`,
						},
						timestamp: Date.now(),
						sequence: counter,
					}
					emit.single(event)
				}, 500)

				// Cleanup
				return Effect.sync(() => {
					clearInterval(intervalId)
				})
			})
		},
	}
}

/**
 * Format a SourceEvent for console output
 */
function formatEvent(event: SourceEvent): string {
	const timestamp = new Date(event.timestamp).toISOString()
	const seq = event.sequence !== undefined ? ` seq=${event.sequence}` : ""
	const dataPreview = JSON.stringify(event.data).slice(0, 100)
	return `[${event.source}]${seq} ${event.type} @ ${timestamp}\n  ${dataPreview}`
}

/**
 * Main spike test
 */
async function main() {
	console.log("🧪 Spike test: Merged Event Streams\n")

	// Create mock SSE source
	const mockSSE = createMockSSESource()
	console.log("✓ Created mock SSE source (500ms heartbeat)")

	// Create swarm.db source (may or may not exist)
	const swarmDbPath = join(homedir(), ".config", "swarm-tools", "swarm.db")
	const swarmDb = createSwarmDbSource(swarmDbPath, 500)
	console.log(`✓ Created swarm.db source (${swarmDbPath})`)

	// Check swarm.db availability
	const isSwarmDbAvailable = await Effect.runPromise(swarmDb.available())
	console.log(
		isSwarmDbAvailable
			? "✓ swarm.db is available - will include in stream"
			: "⚠ swarm.db not found - using only mock source",
	)

	// Create merged stream with both sources
	console.log("\n🌊 Creating merged stream...\n")
	const handle = createMergedWorldStream({
		sources: [mockSSE, swarmDb],
	})

	// Get the merged event stream (internal API for testing)
	const eventStream = handle.stream()

	// Run the stream for 3 seconds (allow time for multiple mock events)
	console.log("📡 Streaming events (3 seconds)...\n")

	const startTime = Date.now()
	let eventCount = 0
	let mockCount = 0
	let swarmCount = 0

	// Track events by source
	const eventsBySource = new Map<string, number>()

	try {
		await Effect.runPromise(
			Stream.runForEach(eventStream, (event) =>
				Effect.sync(() => {
					// Count events by source
					eventCount++
					eventsBySource.set(event.source, (eventsBySource.get(event.source) || 0) + 1)

					if (event.source === "mock-sse") mockCount++
					if (event.source === "swarm-db") swarmCount++

					// Print event (limit output for readability)
					if (eventCount <= 50 || event.source === "mock-sse") {
						console.log(formatEvent(event))
					}

					// Stop after 3 seconds
					if (Date.now() - startTime > 3000) {
						throw new Error("Time limit reached")
					}
				}),
			),
		)
	} catch (error) {
		// Expected timeout error
		if (error instanceof Error && error.message === "Time limit reached") {
			console.log("\n⏱️  Time limit reached")
		} else {
			console.error("\n❌ Stream error:", error)
		}
	}

	// Print summary
	console.log("\n📊 Summary:")
	console.log(`  Total events: ${eventCount}`)
	console.log("\n  Events by source:")
	for (const [source, count] of eventsBySource.entries()) {
		console.log(`    ${source}: ${count}`)
	}

	// Validate
	console.log("\n✅ Validation:")
	const hasMock = eventsBySource.has("mock-sse")
	const hasSwarm = eventsBySource.has("swarm-db")

	if (hasMock) {
		console.log(`  ✓ Mock SSE source is working (${eventsBySource.get("mock-sse")} events)`)
	} else {
		console.log("  ✗ Mock SSE source emitted no events")
	}

	if (isSwarmDbAvailable) {
		if (hasSwarm) {
			console.log(`  ✓ SwarmDb source is working (${eventsBySource.get("swarm-db")} events)`)
		} else {
			console.log("  ⚠ SwarmDb available but no events (may be empty)")
		}
	}

	// Cleanup
	await handle.dispose()
	console.log("\n🏁 Spike test complete")
}

// Run
main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
