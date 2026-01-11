/**
 * World Layer Metrics - Centralized observability metrics for SSE, world state, and performance
 *
 * Defines gauges, counters, and histograms for monitoring the world stream layer.
 * Use these metrics to track:
 * - SSE connection health (connections, reconnections, events)
 * - World state cardinality (total sessions, active sessions)
 * - Performance (event processing time, binary search operations)
 *
 * USAGE:
 * ```typescript
 * import { WorldMetrics } from "./metrics"
 * import { Metric } from "effect"
 *
 * // Increment gauge
 * Metric.increment(WorldMetrics.sseConnectionsActive)
 *
 * // Record counter with label (use Metric.tagged at call site)
 * Metric.increment(WorldMetrics.sseEventsTotal.pipe(
 *   Metric.tagged("event_type", "session:created")
 * ))
 *
 * // Record histogram
 * Metric.record(WorldMetrics.eventProcessingSeconds, durationInSeconds)
 * ```
 */

import { Metric, MetricBoundaries } from "effect"

// Pre-define metrics to avoid TypeScript inference issues with complex Effect types
const sseConnectionsActive = Metric.gauge("sse_connections_active")
const worldSessionsTotal = Metric.gauge("world_sessions_total")
const worldSessionsActive = Metric.gauge("world_sessions_active")
const sseReconnectionsTotal = Metric.counter("sse_reconnections_total")
const binarySearchTotal = Metric.counter("binary_search_total")
const swarmDbPollsTotal = Metric.counter("swarmdb_polls_total")
const sseEventsTotal = Metric.counter("sse_events_total")
const cursorOperationsTotal = Metric.counter("cursor_operations_total")

const eventProcessingBoundaries = MetricBoundaries.exponential({
	start: 0.001,
	factor: 2,
	count: 10,
})
const eventProcessingSeconds = Metric.histogram(
	"event_processing_seconds",
	eventProcessingBoundaries,
)
const swarmDbPollSeconds = Metric.histogram("swarmdb_poll_seconds", eventProcessingBoundaries)
const cursorQuerySeconds = Metric.histogram("cursor_query_seconds", eventProcessingBoundaries)

/**
 * WorldMetrics - Centralized metrics for the world layer
 *
 * Exported as const object to provide:
 * - Type-safe metric access
 * - Consistent naming (follows Prometheus conventions: snake_case)
 * - Documented metric semantics
 */
export const WorldMetrics = {
	// ============================================================================
	// GAUGES - Current state snapshots
	// ============================================================================

	/**
	 * sse_connections_active - Number of active SSE connections
	 *
	 * Tracks current SSE connection count. Increment on connect, decrement on disconnect.
	 * Use for: Connection health monitoring, capacity planning
	 */
	sseConnectionsActive,

	/**
	 * world_sessions_total - Total number of sessions in world state
	 *
	 * Tracks all sessions (active + inactive). Set on world state updates.
	 * Use for: Data cardinality monitoring, memory estimation
	 */
	worldSessionsTotal,

	/**
	 * world_sessions_active - Number of active sessions in world state
	 *
	 * Tracks only active sessions. Set on world state updates.
	 * Use for: User activity monitoring, capacity planning
	 */
	worldSessionsActive,

	// ============================================================================
	// COUNTERS - Cumulative counts (monotonically increasing)
	// ============================================================================

	/**
	 * sse_events_total - Total SSE events received
	 *
	 * Tracks cumulative event count. Increment on each event received.
	 * Add labels at call site with Metric.tagged:
	 *
	 * ```typescript
	 * Metric.increment(WorldMetrics.sseEventsTotal.pipe(
	 *   Metric.tagged("event_type", eventType)
	 * ))
	 * ```
	 *
	 * Use for: Event throughput monitoring, debugging event flows
	 */
	sseEventsTotal,

	/**
	 * sse_reconnections_total - Total SSE reconnection attempts
	 *
	 * Tracks cumulative reconnection count. Increment on each reconnect attempt.
	 * Use for: Connection stability monitoring, network health
	 */
	sseReconnectionsTotal,

	/**
	 * binary_search_total - Total binary search operations
	 *
	 * Tracks cumulative binary search count across all world state updates.
	 * Use for: Performance monitoring, algorithm efficiency validation
	 */
	binarySearchTotal,

	/**
	 * swarmdb_polls_total - Total SwarmDb polling cycles
	 *
	 * Tracks cumulative polling cycles for SwarmDb event source.
	 * Use for: Polling frequency monitoring, event source health
	 */
	swarmDbPollsTotal,

	/**
	 * cursor_operations_total - Total cursor store operations
	 *
	 * Tracks cumulative cursor store operations.
	 * Add labels at call site with Metric.tagged:
	 *
	 * ```typescript
	 * Metric.increment(WorldMetrics.cursorOperationsTotal.pipe(
	 *   Metric.tagged("operation", "save")
	 * ))
	 * ```
	 *
	 * Use for: Database operation monitoring, cursor store health
	 */
	cursorOperationsTotal,

	// ============================================================================
	// HISTOGRAMS - Value distributions
	// ============================================================================

	/**
	 * event_processing_seconds - SSE event processing duration (seconds)
	 *
	 * Tracks distribution of event processing time from SSE receive to world state update.
	 * Buckets: Exponential from 1ms to ~1s (1ms, 2ms, 4ms, 8ms, 16ms, 32ms, 64ms, 128ms, 256ms, 512ms)
	 *
	 * Use for: Performance monitoring, latency percentiles (p50, p95, p99)
	 *
	 * USAGE:
	 * ```typescript
	 * const start = performance.now()
	 * // ... process event ...
	 * const durationSeconds = (performance.now() - start) / 1000
	 * Metric.record(WorldMetrics.eventProcessingSeconds, durationSeconds)
	 * ```
	 */
	eventProcessingSeconds,

	/**
	 * swarmdb_poll_seconds - SwarmDb polling query duration (seconds)
	 *
	 * Tracks distribution of SwarmDb query latency from query start to completion.
	 * Buckets: Same as event_processing_seconds (1ms to ~1s)
	 *
	 * Use for: Database performance monitoring, query latency percentiles
	 */
	swarmDbPollSeconds,

	/**
	 * cursor_query_seconds - Cursor store query duration (seconds)
	 *
	 * Tracks distribution of cursor store query latency.
	 * Buckets: Same as event_processing_seconds (1ms to ~1s)
	 *
	 * Use for: Database performance monitoring, cursor operation latency
	 */
	cursorQuerySeconds,
} as const
