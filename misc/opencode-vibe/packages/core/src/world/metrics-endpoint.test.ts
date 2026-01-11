/**
 * Tests for Prometheus metrics endpoint
 *
 * Verifies Prometheus text format output for gauges, counters, and histograms
 */

import { describe, expect, test } from "vitest"
import { formatPrometheusMetrics, type MetricSnapshot } from "./metrics-endpoint"

describe("formatPrometheusMetrics", () => {
	test("formats a simple counter without labels", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "sse_events_total",
				type: "counter",
				help: "Total SSE events received",
				values: [{ labels: {}, value: 42 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		expect(result).toBe(
			[
				"# HELP sse_events_total Total SSE events received",
				"# TYPE sse_events_total counter",
				"sse_events_total 42",
			].join("\n"),
		)
	})

	test("formats a gauge without labels", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "sse_connections_active",
				type: "gauge",
				help: "Number of active SSE connections",
				values: [{ labels: {}, value: 3 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		expect(result).toBe(
			[
				"# HELP sse_connections_active Number of active SSE connections",
				"# TYPE sse_connections_active gauge",
				"sse_connections_active 3",
			].join("\n"),
		)
	})

	test("formats a counter with labels", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "sse_events_total",
				type: "counter",
				help: "Total SSE events received",
				values: [{ labels: { event_type: "session:created" }, value: 10 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		expect(result).toBe(
			[
				"# HELP sse_events_total Total SSE events received",
				"# TYPE sse_events_total counter",
				'sse_events_total{event_type="session:created"} 10',
			].join("\n"),
		)
	})

	test("formats a counter with multiple label values", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "sse_events_total",
				type: "counter",
				help: "Total SSE events received",
				values: [
					{ labels: { event_type: "session:created" }, value: 10 },
					{ labels: { event_type: "session:updated" }, value: 25 },
				],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		expect(result).toBe(
			[
				"# HELP sse_events_total Total SSE events received",
				"# TYPE sse_events_total counter",
				'sse_events_total{event_type="session:created"} 10',
				'sse_events_total{event_type="session:updated"} 25',
			].join("\n"),
		)
	})

	test("formats a histogram with buckets", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "event_processing_seconds",
				type: "histogram",
				help: "SSE event processing duration",
				values: [],
				buckets: [
					{ le: 0.001, count: 100 },
					{ le: 0.002, count: 250 },
					{ le: 0.004, count: 400 },
					{ le: Number.POSITIVE_INFINITY, count: 500 },
				],
				sum: 1.234,
				count: 500,
			},
		]

		const result = formatPrometheusMetrics(metrics)

		expect(result).toBe(
			[
				"# HELP event_processing_seconds SSE event processing duration",
				"# TYPE event_processing_seconds histogram",
				'event_processing_seconds_bucket{le="0.001"} 100',
				'event_processing_seconds_bucket{le="0.002"} 250',
				'event_processing_seconds_bucket{le="0.004"} 400',
				'event_processing_seconds_bucket{le="+Inf"} 500',
				"event_processing_seconds_sum 1.234",
				"event_processing_seconds_count 500",
			].join("\n"),
		)
	})

	test("formats multiple metrics with blank line separator", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "sse_connections_active",
				type: "gauge",
				help: "Number of active SSE connections",
				values: [{ labels: {}, value: 3 }],
			},
			{
				name: "sse_events_total",
				type: "counter",
				help: "Total SSE events received",
				values: [{ labels: {}, value: 42 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		expect(result).toBe(
			[
				"# HELP sse_connections_active Number of active SSE connections",
				"# TYPE sse_connections_active gauge",
				"sse_connections_active 3",
				"",
				"# HELP sse_events_total Total SSE events received",
				"# TYPE sse_events_total counter",
				"sse_events_total 42",
			].join("\n"),
		)
	})

	test("handles empty metrics array", () => {
		const metrics: MetricSnapshot[] = []
		const result = formatPrometheusMetrics(metrics)
		expect(result).toBe("")
	})

	test("formats metric with multiple labels in sorted order", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "http_requests_total",
				type: "counter",
				help: "HTTP request count",
				values: [{ labels: { status: "200", method: "GET" }, value: 1000 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		// Labels should be in consistent order (alphabetically sorted)
		expect(result).toContain('http_requests_total{method="GET",status="200"} 1000')
	})

	test("escapes special characters in label values", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "logs_total",
				type: "counter",
				help: "Log count",
				values: [{ labels: { message: 'error: "connection failed"' }, value: 5 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		// Double quotes in label values should be escaped
		expect(result).toContain('logs_total{message="error: \\"connection failed\\""} 5')
	})

	test("escapes backslashes in label values", () => {
		const metrics: MetricSnapshot[] = [
			{
				name: "file_operations_total",
				type: "counter",
				help: "File operation count",
				values: [{ labels: { path: "C:\\Users\\joel\\file.txt" }, value: 1 }],
			},
		]

		const result = formatPrometheusMetrics(metrics)

		// Backslashes should be escaped before quotes
		expect(result).toContain('file_operations_total{path="C:\\\\Users\\\\joel\\\\file.txt"} 1')
	})
})
