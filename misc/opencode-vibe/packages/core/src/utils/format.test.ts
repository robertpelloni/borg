/**
 * @opencode-vibe/core/utils/format
 *
 * Tests for formatting utilities.
 * Following TDD - tests written FIRST.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { formatRelativeTime, formatTokens, formatNumber } from "./format.js"

describe("formatRelativeTime", () => {
	let originalNow: typeof Date.now
	let mockNow: number

	beforeEach(() => {
		// Mock Date.now() for deterministic tests
		originalNow = Date.now
		mockNow = new Date("2026-01-01T12:00:00Z").getTime()
		Date.now = () => mockNow
	})

	afterEach(() => {
		Date.now = originalNow
	})

	it("should return 'just now' for timestamps less than 1 minute ago", () => {
		const timestamp = mockNow - 30000 // 30 seconds ago
		expect(formatRelativeTime(timestamp)).toBe("just now")
	})

	it("should return 'just now' for current timestamp", () => {
		expect(formatRelativeTime(mockNow)).toBe("just now")
	})

	it("should format minutes ago (1-59 minutes)", () => {
		const oneMinAgo = mockNow - 60000
		expect(formatRelativeTime(oneMinAgo)).toBe("1m ago")

		const thirtyMinsAgo = mockNow - 1800000
		expect(formatRelativeTime(thirtyMinsAgo)).toBe("30m ago")

		const fiftyNineMinsAgo = mockNow - 3540000
		expect(formatRelativeTime(fiftyNineMinsAgo)).toBe("59m ago")
	})

	it("should format hours ago (1-23 hours)", () => {
		const oneHourAgo = mockNow - 3600000
		expect(formatRelativeTime(oneHourAgo)).toBe("1h ago")

		const twelveHoursAgo = mockNow - 43200000
		expect(formatRelativeTime(twelveHoursAgo)).toBe("12h ago")

		const twentyThreeHoursAgo = mockNow - 82800000
		expect(formatRelativeTime(twentyThreeHoursAgo)).toBe("23h ago")
	})

	it("should format days ago (1-6 days)", () => {
		const oneDayAgo = mockNow - 86400000
		expect(formatRelativeTime(oneDayAgo)).toBe("1d ago")

		const threeDaysAgo = mockNow - 259200000
		expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago")

		const sixDaysAgo = mockNow - 518400000
		expect(formatRelativeTime(sixDaysAgo)).toBe("6d ago")
	})

	it("should return locale date string for 7+ days ago", () => {
		const sevenDaysAgo = mockNow - 604800000
		const date = new Date(sevenDaysAgo)
		expect(formatRelativeTime(sevenDaysAgo)).toBe(date.toLocaleDateString())

		const thirtyDaysAgo = mockNow - 2592000000
		const date2 = new Date(thirtyDaysAgo)
		expect(formatRelativeTime(thirtyDaysAgo)).toBe(date2.toLocaleDateString())
	})

	it("should accept Date objects", () => {
		const fiveMinutesAgo = new Date(mockNow - 300000)
		expect(formatRelativeTime(fiveMinutesAgo)).toBe("5m ago")
	})

	it("should accept timestamps as numbers", () => {
		const tenMinutesAgo = mockNow - 600000
		expect(formatRelativeTime(tenMinutesAgo)).toBe("10m ago")
	})

	it("should handle edge case at exactly 1 minute", () => {
		const exactlyOneMin = mockNow - 60000
		expect(formatRelativeTime(exactlyOneMin)).toBe("1m ago")
	})

	it("should handle edge case at exactly 1 hour", () => {
		const exactlyOneHour = mockNow - 3600000
		expect(formatRelativeTime(exactlyOneHour)).toBe("1h ago")
	})

	it("should handle edge case at exactly 1 day", () => {
		const exactlyOneDay = mockNow - 86400000
		expect(formatRelativeTime(exactlyOneDay)).toBe("1d ago")
	})

	it("should handle edge case at exactly 7 days", () => {
		const exactlySevenDays = mockNow - 604800000
		const date = new Date(exactlySevenDays)
		expect(formatRelativeTime(exactlySevenDays)).toBe(date.toLocaleDateString())
	})
})

describe("formatTokens", () => {
	it("should format numbers less than 1000 as-is", () => {
		expect(formatTokens(0)).toBe("0")
		expect(formatTokens(1)).toBe("1")
		expect(formatTokens(42)).toBe("42")
		expect(formatTokens(999)).toBe("999")
	})

	it("should format thousands with K suffix", () => {
		expect(formatTokens(1000)).toBe("1.0K")
		expect(formatTokens(1500)).toBe("1.5K")
		expect(formatTokens(10000)).toBe("10.0K")
		expect(formatTokens(42500)).toBe("42.5K")
		expect(formatTokens(999999)).toBe("1000.0K")
	})

	it("should format millions with M suffix", () => {
		expect(formatTokens(1000000)).toBe("1.0M")
		expect(formatTokens(1500000)).toBe("1.5M")
		expect(formatTokens(2300000)).toBe("2.3M")
		expect(formatTokens(42000000)).toBe("42.0M")
		expect(formatTokens(200000000)).toBe("200.0M")
	})

	it("should round to 1 decimal place", () => {
		expect(formatTokens(1234)).toBe("1.2K")
		expect(formatTokens(1567)).toBe("1.6K")
		expect(formatTokens(1999999)).toBe("2.0M")
	})

	it("should handle edge cases", () => {
		expect(formatTokens(999)).toBe("999")
		expect(formatTokens(1000)).toBe("1.0K")
		expect(formatTokens(999999)).toBe("1000.0K")
		expect(formatTokens(1000000)).toBe("1.0M")
	})
})

describe("formatNumber", () => {
	it("should format numbers with default options (compact notation)", () => {
		expect(formatNumber(0)).toBe("0")
		expect(formatNumber(42)).toBe("42")
		expect(formatNumber(999)).toBe("999")
		expect(formatNumber(1000)).toBe("1K")
		expect(formatNumber(1500)).toBe("1.5K")
		expect(formatNumber(1000000)).toBe("1M")
		expect(formatNumber(2300000)).toBe("2.3M")
	})

	it("should format with custom locale", () => {
		// German locale uses comma for decimal separator in compact notation
		const result = formatNumber(1500, { locale: "de-DE" })
		// In compact mode, might be "1,5 Tsd" or "1.5K" depending on locale support
		expect(result).toBeTruthy()
		expect(typeof result).toBe("string")
	})

	it("should format with custom notation", () => {
		expect(formatNumber(1234567, { notation: "standard" })).toMatch(/1[,.]234[,.]567/)
		expect(formatNumber(1234567, { notation: "scientific" })).toMatch(/1[,.]23/)
		expect(formatNumber(1234567, { notation: "engineering" })).toMatch(/1[,.]23/)
	})

	it("should format with custom significant digits", () => {
		expect(formatNumber(1234, { maximumSignificantDigits: 2 })).toMatch(/1[,.]2K/)
		expect(formatNumber(1234, { maximumSignificantDigits: 3 })).toMatch(/1[,.]23K/)
	})

	it("should format with custom fraction digits", () => {
		expect(formatNumber(1567, { maximumFractionDigits: 0 })).toBe("2K")
		expect(formatNumber(1567, { maximumFractionDigits: 2 })).toMatch(/1[,.]5/)
	})

	it("should format currency", () => {
		expect(formatNumber(1234.56, { style: "currency", currency: "USD" })).toMatch(/\$1[,.]2K/)
	})

	it("should format percentages", () => {
		expect(formatNumber(0.756, { style: "percent" })).toMatch(/76%/)
	})
})
