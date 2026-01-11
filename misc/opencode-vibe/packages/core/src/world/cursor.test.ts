import { describe, expect, it } from "vitest"
import { Schema as S } from "effect"
import { EventOffset, StreamCursor } from "./cursor.js"

describe("EventOffset", () => {
	it("should be a branded string type", () => {
		const offset = S.decodeSync(EventOffset)("12345")
		expect(offset).toBe("12345")
	})

	it("should validate numeric strings", () => {
		expect(() => S.decodeSync(EventOffset)("12345")).not.toThrow()
		expect(() => S.decodeSync(EventOffset)("0")).not.toThrow()
		expect(() => S.decodeSync(EventOffset)("999999")).not.toThrow()
	})

	it("should reject non-numeric strings", () => {
		expect(() => S.decodeSync(EventOffset)("abc")).toThrow()
		expect(() => S.decodeSync(EventOffset)("12a45")).toThrow()
		expect(() => S.decodeSync(EventOffset)("")).toThrow()
	})

	it("should be lexicographically sortable", () => {
		const offsets = ["10", "2", "100", "20"].map((s) => S.decodeSync(EventOffset)(s))
		const sorted = [...offsets].sort()

		// Lexicographic sort of numeric strings: "10", "100", "2", "20"
		// For proper numeric ordering, offsets should be zero-padded
		expect(sorted).toEqual(["10", "100", "2", "20"])
	})
})

describe("StreamCursor", () => {
	it("should decode valid cursor", () => {
		const cursor = S.decodeSync(StreamCursor)({
			offset: "12345",
			timestamp: 1234567890,
			projectKey: "/path/to/project",
		})

		expect(cursor.offset).toBe("12345")
		expect(cursor.timestamp).toBe(1234567890)
		expect(cursor.projectKey).toBe("/path/to/project")
	})

	it("should reject invalid offset", () => {
		expect(() =>
			S.decodeSync(StreamCursor)({
				offset: "abc",
				timestamp: 1234567890,
				projectKey: "/path/to/project",
			}),
		).toThrow()
	})

	it("should require all fields", () => {
		expect(() =>
			// @ts-expect-error - testing runtime validation
			S.decodeSync(StreamCursor)({
				offset: "12345",
				timestamp: 1234567890,
			}),
		).toThrow()

		expect(() =>
			// @ts-expect-error - testing runtime validation
			S.decodeSync(StreamCursor)({
				offset: "12345",
				projectKey: "/path/to/project",
			}),
		).toThrow()
	})

	it("should validate timestamp as number", () => {
		expect(() =>
			S.decodeSync(StreamCursor)({
				offset: "12345",
				// @ts-expect-error - testing runtime validation
				timestamp: "not a number",
				projectKey: "/path/to/project",
			}),
		).toThrow()
	})
})
