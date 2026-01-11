/**
 * @opencode-vibe/core/utils/format
 *
 * Formatting utilities for dates, numbers, and tokens.
 * Pure functions, SSR-compatible (no window/document references).
 */

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago", "3d ago")
 *
 * @param timestamp - Date object or timestamp in milliseconds
 * @returns Formatted relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime(Date.now() - 300000) // "5m ago"
 * formatRelativeTime(new Date(Date.now() - 7200000)) // "2h ago"
 * ```
 */
export function formatRelativeTime(timestamp: Date | number): string {
	const now = Date.now()
	const time = timestamp instanceof Date ? timestamp.getTime() : timestamp
	const diffMs = now - time
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMs / 3600000)
	const diffDays = Math.floor(diffMs / 86400000)

	if (diffMins < 1) return "just now"
	if (diffMins < 60) return `${diffMins}m ago`
	if (diffHours < 24) return `${diffHours}h ago`
	if (diffDays < 7) return `${diffDays}d ago`
	return new Date(time).toLocaleDateString()
}

/**
 * Format token count with K/M suffix
 *
 * @param n - Token count
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 *
 * @example
 * ```ts
 * formatTokens(1500) // "1.5K"
 * formatTokens(2300000) // "2.3M"
 * formatTokens(42) // "42"
 * ```
 */
export function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return n.toString()
}

/**
 * Options for formatNumber
 */
export interface FormatNumberOptions {
	/**
	 * Locale to use for formatting (default: "en-US")
	 */
	locale?: string

	/**
	 * Number notation style
	 * - "standard": normal number (1,234,567)
	 * - "scientific": scientific notation (1.23E6)
	 * - "engineering": engineering notation (1.234E6)
	 * - "compact": compact notation (1.2M) - default
	 */
	notation?: "standard" | "scientific" | "engineering" | "compact"

	/**
	 * Number format style
	 * - "decimal": plain number (default)
	 * - "currency": currency format ($1.23)
	 * - "percent": percentage format (12%)
	 * - "unit": unit format (12 kg)
	 */
	style?: "decimal" | "currency" | "percent" | "unit"

	/**
	 * Currency code (required if style="currency")
	 */
	currency?: string

	/**
	 * Unit (required if style="unit")
	 */
	unit?: string

	/**
	 * Maximum number of significant digits
	 */
	maximumSignificantDigits?: number

	/**
	 * Maximum number of fraction digits
	 */
	maximumFractionDigits?: number

	/**
	 * Minimum number of fraction digits
	 */
	minimumFractionDigits?: number
}

/**
 * Format a number using Intl.NumberFormat with compact notation by default
 *
 * @param n - Number to format
 * @param options - Formatting options
 * @returns Formatted string
 *
 * @example
 * ```ts
 * formatNumber(1234567) // "1.2M"
 * formatNumber(1234567, { notation: "standard" }) // "1,234,567"
 * formatNumber(0.756, { style: "percent" }) // "76%"
 * formatNumber(1234.56, { style: "currency", currency: "USD" }) // "$1.2K"
 * ```
 */
export function formatNumber(n: number, options: FormatNumberOptions = {}): string {
	const {
		locale = "en-US",
		notation = "compact",
		style = "decimal",
		currency,
		unit,
		maximumSignificantDigits,
		maximumFractionDigits,
		minimumFractionDigits,
	} = options

	const formatOptions: Intl.NumberFormatOptions = {
		notation,
		style,
	}

	if (style === "currency" && currency) {
		formatOptions.currency = currency
	}

	if (style === "unit" && unit) {
		formatOptions.unit = unit
	}

	if (maximumSignificantDigits !== undefined) {
		formatOptions.maximumSignificantDigits = maximumSignificantDigits
	}

	if (maximumFractionDigits !== undefined) {
		formatOptions.maximumFractionDigits = maximumFractionDigits
	}

	if (minimumFractionDigits !== undefined) {
		formatOptions.minimumFractionDigits = minimumFractionDigits
	}

	return new Intl.NumberFormat(locale, formatOptions).format(n)
}
