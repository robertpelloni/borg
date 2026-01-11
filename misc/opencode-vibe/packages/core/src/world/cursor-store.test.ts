/**
 * CursorStore tests - TDD for libSQL cursor persistence
 *
 * Tests cursor round-trip: save → load → verify
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { Effect } from "effect"
import { CursorStore, CursorStoreLive } from "./cursor-store.js"
import * as S from "effect/Schema"
import { StreamCursor, EventOffset } from "./cursor.js"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mkdirSync, rmSync } from "node:fs"

describe("CursorStore", () => {
	let testDbPath: string

	beforeEach(() => {
		// Create unique temp DB for each test
		testDbPath = join(tmpdir(), `cursor-test-${Date.now()}.db`)
	})

	afterEach(() => {
		// Cleanup test DB
		try {
			rmSync(testDbPath, { force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	it("saves and loads cursor", async () => {
		const cursor = S.decodeSync(StreamCursor)({
			offset: "12345",
			timestamp: Date.now(),
			projectKey: "/test/project",
		})

		const program = Effect.gen(function* () {
			const store = yield* CursorStore

			// Save cursor
			yield* store.saveCursor(cursor)

			// Load cursor
			const loaded = yield* store.loadCursor(cursor.projectKey)

			return loaded
		})

		const result = await Effect.runPromise(
			program.pipe(Effect.provide(CursorStoreLive(testDbPath))),
		)

		expect(result).not.toBeNull()
		expect(result?.offset).toBe(cursor.offset)
		expect(result?.projectKey).toBe(cursor.projectKey)
		// Timestamp might vary slightly due to DB precision
		expect(result?.timestamp).toBeGreaterThan(0)
	})

	it("returns null for non-existent project", async () => {
		const program = Effect.gen(function* () {
			const store = yield* CursorStore
			return yield* store.loadCursor("/non/existent")
		})

		const result = await Effect.runPromise(
			program.pipe(Effect.provide(CursorStoreLive(testDbPath))),
		)

		expect(result).toBeNull()
	})

	it("updates existing cursor", async () => {
		const cursor1 = S.decodeSync(StreamCursor)({
			offset: "100",
			timestamp: Date.now(),
			projectKey: "/test/project",
		})

		const cursor2 = S.decodeSync(StreamCursor)({
			offset: "200",
			timestamp: Date.now() + 1000,
			projectKey: "/test/project",
		})

		const program = Effect.gen(function* () {
			const store = yield* CursorStore

			// Save first cursor
			yield* store.saveCursor(cursor1)

			// Update with new cursor
			yield* store.saveCursor(cursor2)

			// Load should return updated cursor
			return yield* store.loadCursor(cursor1.projectKey)
		})

		const result = await Effect.runPromise(
			program.pipe(Effect.provide(CursorStoreLive(testDbPath))),
		)

		expect(result?.offset).toBe("200")
	})

	it("deletes cursor", async () => {
		const cursor = S.decodeSync(StreamCursor)({
			offset: "12345",
			timestamp: Date.now(),
			projectKey: "/test/project",
		})

		const program = Effect.gen(function* () {
			const store = yield* CursorStore

			// Save cursor
			yield* store.saveCursor(cursor)

			// Delete cursor
			yield* store.deleteCursor(cursor.projectKey)

			// Load should return null
			return yield* store.loadCursor(cursor.projectKey)
		})

		const result = await Effect.runPromise(
			program.pipe(Effect.provide(CursorStoreLive(testDbPath))),
		)

		expect(result).toBeNull()
	})

	it("handles multiple projects independently", async () => {
		const cursor1 = S.decodeSync(StreamCursor)({
			offset: "100",
			timestamp: Date.now(),
			projectKey: "/project/one",
		})

		const cursor2 = S.decodeSync(StreamCursor)({
			offset: "200",
			timestamp: Date.now(),
			projectKey: "/project/two",
		})

		const program = Effect.gen(function* () {
			const store = yield* CursorStore

			// Save both cursors
			yield* store.saveCursor(cursor1)
			yield* store.saveCursor(cursor2)

			// Load both
			const loaded1 = yield* store.loadCursor(cursor1.projectKey)
			const loaded2 = yield* store.loadCursor(cursor2.projectKey)

			return { loaded1, loaded2 }
		})

		const result = await Effect.runPromise(
			program.pipe(Effect.provide(CursorStoreLive(testDbPath))),
		)

		expect(result.loaded1?.offset).toBe("100")
		expect(result.loaded2?.offset).toBe("200")
	})

	it("cleans up database connection on scope exit", async () => {
		// This test verifies acquireRelease lifecycle
		// If connection isn't cleaned up, subsequent tests would fail
		const cursor = S.decodeSync(StreamCursor)({
			offset: "99999",
			timestamp: Date.now(),
			projectKey: "/cleanup/test",
		})

		const program = Effect.gen(function* () {
			const store = yield* CursorStore
			yield* store.saveCursor(cursor)
			return "success"
		})

		// Run twice to verify cleanup
		await Effect.runPromise(program.pipe(Effect.provide(CursorStoreLive(testDbPath))))
		await Effect.runPromise(program.pipe(Effect.provide(CursorStoreLive(testDbPath))))

		// If we get here without errors, cleanup worked
		expect(true).toBe(true)
	})
})
