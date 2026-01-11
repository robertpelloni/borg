/**
 * Tests for prompt API - convertToApiParts
 */

import { describe, it, expect } from "vitest"
import { convertToApiParts } from "./prompt.js"
import type { Prompt } from "../types/prompt.js"

describe("convertToApiParts", () => {
	const testDirectory = "/Users/test/project"

	it("converts text part with generated ID", () => {
		const parts: Prompt = [
			{
				type: "text",
				content: "Hello world",
				start: 0,
				end: 11,
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result).toHaveLength(1)
		expect(result[0]).toMatchObject({
			type: "text",
			text: "Hello world",
		})
		expect(result[0]).toHaveProperty("id")
		if (result[0].type === "text") {
			expect(typeof result[0].id).toBe("string")
		}
	})

	it("converts file part with absolute path", () => {
		const parts: Prompt = [
			{
				type: "file",
				path: "/absolute/path/test.ts",
				content: "@test.ts",
				start: 0,
				end: 8,
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			type: "file",
			mime: "text/plain",
			url: "file:///absolute/path/test.ts",
			filename: "test.ts",
		})
	})

	it("converts file part with relative path", () => {
		const parts: Prompt = [
			{
				type: "file",
				path: "src/app.ts",
				content: "@src/app.ts",
				start: 0,
				end: 11,
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			type: "file",
			mime: "text/plain",
			url: `file://${testDirectory}/src/app.ts`,
			filename: "app.ts",
		})
	})

	it("detects MIME type from file extension", () => {
		const parts: Prompt = [
			{
				type: "file",
				path: "test.json",
				content: "@test.json",
				start: 0,
				end: 10,
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result[0]).toMatchObject({
			type: "file",
			mime: "application/json",
			filename: "test.json",
		})
	})

	it("converts image part", () => {
		const parts: Prompt = [
			{
				type: "image",
				id: "img-123",
				filename: "screenshot.png",
				mime: "image/png",
				dataUrl: "data:image/png;base64,iVBORw0KGgo=",
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({
			type: "image",
			mime: "image/png",
			url: "data:image/png;base64,iVBORw0KGgo=",
			filename: "screenshot.png",
		})
	})

	it("converts mixed parts array", () => {
		const parts: Prompt = [
			{
				type: "text",
				content: "Check this file: ",
				start: 0,
				end: 17,
			},
			{
				type: "file",
				path: "src/test.ts",
				content: "@src/test.ts",
				start: 17,
				end: 29,
			},
			{
				type: "text",
				content: " and this image: ",
				start: 29,
				end: 46,
			},
			{
				type: "image",
				id: "img-1",
				filename: "example.jpg",
				mime: "image/jpeg",
				dataUrl: "data:image/jpeg;base64,/9j/4AAQ",
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result).toHaveLength(4)
		expect(result[0].type).toBe("text")
		expect(result[1].type).toBe("file")
		expect(result[2].type).toBe("text")
		expect(result[3].type).toBe("image")
	})

	it("handles various file extensions with correct MIME types", () => {
		const extensions = [
			{ ext: "md", mime: "text/markdown" },
			{ ext: "js", mime: "text/javascript" },
			{ ext: "tsx", mime: "text/plain" },
			{ ext: "css", mime: "text/css" },
			{ ext: "html", mime: "text/html" },
			{ ext: "png", mime: "image/png" },
			{ ext: "jpg", mime: "image/jpeg" },
			{ ext: "svg", mime: "image/svg+xml" },
			{ ext: "unknown", mime: "text/plain" }, // fallback
		]

		for (const { ext, mime } of extensions) {
			const parts: Prompt = [
				{
					type: "file",
					path: `test.${ext}`,
					content: `@test.${ext}`,
					start: 0,
					end: 10,
				},
			]

			const result = convertToApiParts(parts, testDirectory)
			expect(result[0]).toMatchObject({
				mime,
			})
		}
	})

	it("generates unique IDs for multiple text parts", () => {
		const parts: Prompt = [
			{
				type: "text",
				content: "First",
				start: 0,
				end: 5,
			},
			{
				type: "text",
				content: "Second",
				start: 5,
				end: 11,
			},
		]

		const result = convertToApiParts(parts, testDirectory)

		expect(result).toHaveLength(2)
		if (result[0].type === "text" && result[1].type === "text") {
			expect(result[0].id).not.toBe(result[1].id)
		}
	})
})
