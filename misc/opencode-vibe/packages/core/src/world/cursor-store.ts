/**
 * CursorStore - Effect Layer service for persisting StreamCursor to libSQL
 *
 * Provides durable storage for event stream cursors, enabling resume-after-disconnect.
 * Database colocated with app at apps/swarm-cli/data/cursors.db
 *
 * Pattern: Effect Layer with acquireRelease for DB connection lifecycle
 */

import { Effect, Context, Layer, Metric } from "effect"
import { createClient, type Client } from "@libsql/client"
import type { StreamCursor } from "./cursor.js"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { WorldMetrics } from "./metrics.js"

/**
 * CursorStore service interface
 */
export interface CursorStoreService {
	/**
	 * Save cursor for a project (upsert)
	 */
	saveCursor: (cursor: StreamCursor) => Effect.Effect<void, Error, never>

	/**
	 * Load cursor for a project
	 */
	loadCursor: (projectKey: string) => Effect.Effect<StreamCursor | null, Error, never>

	/**
	 * Delete cursor for a project
	 */
	deleteCursor: (projectKey: string) => Effect.Effect<void, Error, never>
}

/**
 * CursorStore service tag
 */
export class CursorStore extends Context.Tag("CursorStore")<CursorStore, CursorStoreService>() {}

/**
 * Initialize database schema
 */
const initSchema = (client: Client): Effect.Effect<void, Error, never> =>
	Effect.tryPromise({
		try: async () => {
			await client.execute(`
				CREATE TABLE IF NOT EXISTS cursors (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					project_key TEXT UNIQUE NOT NULL,
					offset TEXT NOT NULL,
					timestamp INTEGER NOT NULL,
					updated_at INTEGER NOT NULL DEFAULT (unixepoch())
				);
				CREATE INDEX IF NOT EXISTS idx_cursors_project_key ON cursors(project_key);
			`)
		},
		catch: (error) => new Error(`Failed to initialize schema: ${error}`),
	})

/**
 * Create CursorStore service implementation
 */
const makeCursorStore = (client: Client): CursorStoreService => ({
	saveCursor: (cursor: StreamCursor) =>
		Effect.gen(function* () {
			const startTime = performance.now()

			yield* Effect.logDebug("Cursor save started").pipe(
				Effect.annotateLogs({
					operation: "save",
					projectKey: cursor.projectKey,
				}),
			)

			yield* Effect.tryPromise({
				try: async () => {
					await client.execute({
						sql: `
							INSERT INTO cursors (project_key, offset, timestamp, updated_at)
							VALUES (?, ?, ?, unixepoch())
							ON CONFLICT(project_key) DO UPDATE SET
								offset = excluded.offset,
								timestamp = excluded.timestamp,
								updated_at = unixepoch()
						`,
						args: [cursor.projectKey, cursor.offset, cursor.timestamp],
					})
				},
				catch: (error) => new Error(`Failed to save cursor: ${error}`),
			})

			const durationSeconds = (performance.now() - startTime) / 1000
			yield* Metric.update(
				WorldMetrics.cursorOperationsTotal.pipe(Metric.tagged("operation", "save")),
				1,
			)
			yield* Metric.update(WorldMetrics.cursorQuerySeconds, durationSeconds)

			yield* Effect.logDebug("Cursor save completed").pipe(
				Effect.annotateLogs({
					operation: "save",
					projectKey: cursor.projectKey,
					durationMs: String((performance.now() - startTime).toFixed(2)),
				}),
			)
		}),

	loadCursor: (projectKey: string) =>
		Effect.gen(function* () {
			const startTime = performance.now()

			yield* Effect.logDebug("Cursor load started").pipe(
				Effect.annotateLogs({
					operation: "load",
					projectKey,
				}),
			)

			const result = yield* Effect.tryPromise({
				try: async () => {
					const result = await client.execute({
						sql: "SELECT offset, timestamp, project_key FROM cursors WHERE project_key = ?",
						args: [projectKey],
					})

					if (result.rows.length === 0) {
						return null
					}

					const row = result.rows[0]
					return {
						offset: String(row.offset),
						timestamp: Number(row.timestamp),
						projectKey: String(row.project_key),
					} as StreamCursor
				},
				catch: (error) => new Error(`Failed to load cursor: ${error}`),
			})

			const durationSeconds = (performance.now() - startTime) / 1000
			yield* Metric.update(
				WorldMetrics.cursorOperationsTotal.pipe(Metric.tagged("operation", "load")),
				1,
			)
			yield* Metric.update(WorldMetrics.cursorQuerySeconds, durationSeconds)

			yield* Effect.logDebug("Cursor load completed").pipe(
				Effect.annotateLogs({
					operation: "load",
					projectKey,
					found: String(result !== null),
					durationMs: String((performance.now() - startTime).toFixed(2)),
				}),
			)

			return result
		}),

	deleteCursor: (projectKey: string) =>
		Effect.gen(function* () {
			const startTime = performance.now()

			yield* Effect.logDebug("Cursor delete started").pipe(
				Effect.annotateLogs({
					operation: "delete",
					projectKey,
				}),
			)

			yield* Effect.tryPromise({
				try: async () => {
					await client.execute({
						sql: "DELETE FROM cursors WHERE project_key = ?",
						args: [projectKey],
					})
				},
				catch: (error) => new Error(`Failed to delete cursor: ${error}`),
			})

			const durationSeconds = (performance.now() - startTime) / 1000
			yield* Metric.update(
				WorldMetrics.cursorOperationsTotal.pipe(Metric.tagged("operation", "delete")),
				1,
			)
			yield* Metric.update(WorldMetrics.cursorQuerySeconds, durationSeconds)

			yield* Effect.logDebug("Cursor delete completed").pipe(
				Effect.annotateLogs({
					operation: "delete",
					projectKey,
					durationMs: String((performance.now() - startTime).toFixed(2)),
				}),
			)
		}),
})

/**
 * CursorStore Effect Layer with acquireRelease lifecycle
 *
 * @param dbPath - Path to SQLite database file
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const store = yield* CursorStore
 *   yield* store.saveCursor(cursor)
 *   return yield* store.loadCursor("/project/path")
 * })
 *
 * Effect.runPromise(
 *   program.pipe(Effect.provide(CursorStoreLive("./data/cursors.db")))
 * )
 * ```
 */
export const CursorStoreLive = (dbPath: string): Layer.Layer<CursorStore, Error, never> =>
	Layer.scoped(
		CursorStore,
		Effect.acquireRelease(
			Effect.gen(function* () {
				// Ensure directory exists
				yield* Effect.sync(() => {
					mkdirSync(dirname(dbPath), { recursive: true })
				})

				// Create client
				const client = yield* Effect.sync(() =>
					createClient({
						url: `file:${dbPath}`,
					}),
				)

				// Initialize schema
				yield* initSchema(client)

				// Return service
				return makeCursorStore(client)
			}),
			(service) =>
				Effect.sync(() => {
					// Cleanup: close database connection
					// libSQL client doesn't have explicit close() in all versions
					// Connection will be cleaned up by GC
				}),
		),
	)
