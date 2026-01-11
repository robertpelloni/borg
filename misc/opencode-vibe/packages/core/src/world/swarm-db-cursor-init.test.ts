/**
 * SwarmDb Cursor Initialization Test
 *
 * Tests that createSwarmDbSource initializes cursor to current max sequence,
 * preventing flood of historical events on first poll.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createSwarmDbSource } from "./event-source.js"
import { Effect, Stream } from "effect"
import { createClient } from "@libsql/client"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SourceEvent } from "./event-source.js"

describe("SwarmDb cursor initialization", () => {
	let testDbPath: string
	let tempDir: string

	beforeEach(async () => {
		// Create temporary directory
		tempDir = mkdtempSync(join(tmpdir(), "swarmdb-test-"))
		testDbPath = join(tempDir, "test.db")

		// Create test database with schema
		const client = createClient({ url: `file:${testDbPath}` })

		await client.execute(`
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        project_key TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT NOT NULL
      )
    `)

		// Insert 100 historical events
		for (let i = 1; i <= 100; i++) {
			await client.execute({
				sql: `INSERT INTO events (sequence, type, project_key, timestamp, data)
            VALUES (?, ?, ?, ?, ?)`,
				args: [i, `event.${i}`, "/test", Date.now() - 100000 + i, JSON.stringify({ index: i })],
			})
		}

		client.close()
	})

	afterEach(() => {
		// Clean up test database
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true })
		}
	})

	it("initializes cursor to current max sequence, avoiding historical event flood", async () => {
		const source = createSwarmDbSource(testDbPath, 100) // Poll every 100ms

		// Collect events for 300ms (3 polling cycles)
		const events: SourceEvent[] = []

		const collectEffect = Stream.runForEach(source.stream(), (event) =>
			Effect.sync(() => {
				events.push(event)
			}),
		)

		// Run collector for 300ms
		const timeoutEffect = Effect.sleep("300 millis").pipe(Effect.andThen(Effect.void))

		await Effect.runPromise(Effect.race(collectEffect, timeoutEffect))

		// Should have 0 events - all 100 historical events are skipped
		// (cursor initialized to max sequence 100)
		expect(events.length).toBe(0)
	})

	it("streams NEW events after initialization", async () => {
		const source = createSwarmDbSource(testDbPath, 100) // Poll every 100ms

		const events: SourceEvent[] = []

		const collectEffect = Stream.runForEach(source.stream(), (event) =>
			Effect.sync(() => {
				events.push(event)
			}),
		)

		// Start collecting
		const collectPromise = Effect.runPromise(collectEffect)

		// Wait 150ms for initialization
		await new Promise((resolve) => setTimeout(resolve, 150))

		// Insert NEW events AFTER stream starts
		const client = createClient({ url: `file:${testDbPath}` })
		await client.execute({
			sql: `INSERT INTO events (sequence, type, project_key, timestamp, data)
          VALUES (?, ?, ?, ?, ?)`,
			args: [101, "new.event.1", "/test", Date.now(), JSON.stringify({ new: true, index: 101 })],
		})
		await client.execute({
			sql: `INSERT INTO events (sequence, type, project_key, timestamp, data)
          VALUES (?, ?, ?, ?, ?)`,
			args: [102, "new.event.2", "/test", Date.now(), JSON.stringify({ new: true, index: 102 })],
		})
		client.close()

		// Wait for next poll cycle to pick up new events
		await new Promise((resolve) => setTimeout(resolve, 200))

		// Stop collecting
		collectPromise.catch(() => {
			/* ignore cancellation */
		})

		// Should have captured the 2 new events
		expect(events.length).toBe(2)
		expect(events[0].type).toBe("new.event.1")
		expect(events[1].type).toBe("new.event.2")
		expect((events[0].data as any).new).toBe(true)
		expect((events[1].data as any).new).toBe(true)
	})
})
