/**
 * Prometheus Metrics Endpoint - Expose Effect metrics in Prometheus text format
 *
 * Formats metrics as text/plain in Prometheus exposition format for scraping.
 * Can be mounted at /metrics by consuming app (Hono, Express, Next.js API route, etc.).
 *
 * PROMETHEUS TEXT FORMAT:
 * ```
 * # HELP metric_name Description of the metric
 * # TYPE metric_name counter|gauge|histogram
 * metric_name{label1="value1",label2="value2"} 123
 * ```
 *
 * HISTOGRAM FORMAT:
 * ```
 * # HELP http_request_duration_seconds HTTP request duration
 * # TYPE http_request_duration_seconds histogram
 * http_request_duration_seconds_bucket{le="0.01"} 100
 * http_request_duration_seconds_bucket{le="0.05"} 500
 * http_request_duration_seconds_bucket{le="+Inf"} 1000
 * http_request_duration_seconds_sum 123.456
 * http_request_duration_seconds_count 1000
 * ```
 *
 * USAGE:
 * ```typescript
 * // Next.js API route
 * import { formatPrometheusMetrics } from "@opencode-vibe/core/world/metrics-endpoint"
 *
 * export async function GET() {
 *   const metrics = await collectWorldMetrics() // Gather from Metric registry
 *   const body = formatPrometheusMetrics(metrics)
 *
 *   return new Response(body, {
 *     headers: {
 *       "Content-Type": "text/plain; version=0.0.4; charset=utf-8"
 *     }
 *   })
 * }
 * ```
 */

export interface MetricSnapshot {
	/** Metric name (snake_case, follows Prometheus naming conventions) */
	name: string

	/** Metric type determines output format */
	type: "counter" | "gauge" | "histogram" | "summary"

	/** Human-readable description for # HELP line */
	help: string

	/** Metric values with optional labels (for counter and gauge) */
	values: Array<{
		labels: Record<string, string>
		value: number
	}>

	/** Histogram buckets (le = "less than or equal") */
	buckets?: Array<{
		le: number
		count: number
	}>

	/** Histogram sum (total of all observed values) */
	sum?: number

	/** Histogram count (total number of observations) */
	count?: number
}

/**
 * Formats metrics in Prometheus text exposition format
 *
 * @param metrics - Array of metric snapshots to format
 * @returns Text in Prometheus exposition format (text/plain)
 *
 * @example
 * ```typescript
 * const metrics: MetricSnapshot[] = [
 *   {
 *     name: "sse_connections_active",
 *     type: "gauge",
 *     help: "Number of active SSE connections",
 *     values: [{ labels: {}, value: 3 }]
 *   }
 * ]
 * const output = formatPrometheusMetrics(metrics)
 * // # HELP sse_connections_active Number of active SSE connections
 * // # TYPE sse_connections_active gauge
 * // sse_connections_active 3
 * ```
 */
export function formatPrometheusMetrics(metrics: MetricSnapshot[]): string {
	if (metrics.length === 0) {
		return ""
	}

	const metricBlocks: string[] = []

	for (const metric of metrics) {
		const lines: string[] = []

		// HELP and TYPE comments
		lines.push(`# HELP ${metric.name} ${metric.help}`)
		lines.push(`# TYPE ${metric.name} ${metric.type}`)

		if (metric.type === "histogram") {
			// Histogram format: buckets, sum, count
			if (metric.buckets) {
				for (const bucket of metric.buckets) {
					const leValue = bucket.le === Number.POSITIVE_INFINITY ? "+Inf" : bucket.le.toString()
					lines.push(`${metric.name}_bucket{le="${leValue}"} ${bucket.count}`)
				}
			}
			if (metric.sum !== undefined) {
				lines.push(`${metric.name}_sum ${metric.sum}`)
			}
			if (metric.count !== undefined) {
				lines.push(`${metric.name}_count ${metric.count}`)
			}
		} else {
			// Counter or Gauge format: metric_name{labels} value
			for (const { labels, value } of metric.values) {
				const labelStr = formatLabels(labels)
				lines.push(`${metric.name}${labelStr} ${value}`)
			}
		}

		metricBlocks.push(lines.join("\n"))
	}

	return metricBlocks.join("\n\n")
}

/**
 * Formats label key-value pairs in Prometheus format
 *
 * Labels are sorted alphabetically for consistent output.
 * Double quotes in label values are escaped.
 *
 * @param labels - Label key-value pairs
 * @returns Formatted label string like `{key1="value1",key2="value2"}` or empty string
 *
 * @example
 * ```typescript
 * formatLabels({ status: "200", method: "GET" })
 * // '{method="GET",status="200"}'
 *
 * formatLabels({})
 * // ''
 * ```
 */
function formatLabels(labels: Record<string, string>): string {
	const entries = Object.entries(labels)

	if (entries.length === 0) {
		return ""
	}

	// Sort labels alphabetically for consistent output
	const sorted = entries.sort(([a], [b]) => a.localeCompare(b))

	// Escape double quotes in label values
	const formatted = sorted.map(([key, value]) => {
		const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
		return `${key}="${escaped}"`
	})

	return `{${formatted.join(",")}}`
}
