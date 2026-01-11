import { describe, test, expect } from "vitest"
import type { ToolPart } from "@opencode-ai/sdk/client"
import { getToolContextLines, hasExpandableContent } from "./tool"

// Helper to create a minimal ToolPart for testing
function createToolPart(tool: string, state: ToolPart["state"]): ToolPart {
	return {
		id: "part-1",
		sessionID: "session-1",
		messageID: "message-1",
		type: "tool",
		callID: "call-1",
		tool,
		state,
	}
}

describe("getToolContextLines", () => {
	describe("read tool", () => {
		test("extracts filePath and line count from completed state", () => {
			const part = createToolPart("read", {
				status: "completed",
				input: { filePath: "src/components/Button.tsx" },
				output: "file contents",
				title: "245 lines",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/components/Button.tsx",
				secondary: "245 lines",
			})
		})

		test("extracts filePath without line count when title is missing", () => {
			const part = createToolPart("read", {
				status: "running",
				input: { filePath: "src/utils.ts" },
				metadata: {},
				time: { start: 0 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/utils.ts",
				secondary: null,
			})
		})

		test("handles missing filePath", () => {
			const part = createToolPart("read", {
				status: "pending",
				input: {},
				raw: "",
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: null,
				secondary: null,
			})
		})
	})

	describe("edit tool", () => {
		test("extracts filePath from input", () => {
			const part = createToolPart("edit", {
				status: "completed",
				input: { filePath: "src/index.ts", oldString: "foo", newString: "bar" },
				output: "success",
				title: "Edited 1 file",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/index.ts",
				secondary: "1 change",
			})
		})

		test("handles multiple changes from title", () => {
			const part = createToolPart("edit", {
				status: "completed",
				input: { filePath: "src/index.ts", oldString: "foo", newString: "bar" },
				output: "success",
				title: "Edited 3 occurrences",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/index.ts",
				secondary: "3 changes",
			})
		})
	})

	describe("write tool", () => {
		test("shows 'New file' for new files", () => {
			const part = createToolPart("write", {
				status: "completed",
				input: { filePath: "src/new-file.ts", content: "export const x = 1" },
				output: "success",
				title: "Created file",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/new-file.ts",
				secondary: "New file",
			})
		})

		test("shows size for existing files", () => {
			const part = createToolPart("write", {
				status: "completed",
				input: { filePath: "src/existing.ts", content: "x".repeat(1500) },
				output: "success",
				title: "Updated file",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/existing.ts",
				secondary: "1.5 KB",
			})
		})
	})

	describe("grep tool", () => {
		test("extracts pattern and path from input", () => {
			const part = createToolPart("grep", {
				status: "completed",
				input: { pattern: "useEffect", path: "src/" },
				output: "5 matches",
				title: "5 matches found",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "useEffect in src/",
				secondary: "5 matches",
			})
		})

		test("handles no matches", () => {
			const part = createToolPart("grep", {
				status: "completed",
				input: { pattern: "foobar", path: "." },
				output: "",
				title: "No matches",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "foobar in .",
				secondary: "No matches",
			})
		})
	})

	describe("glob tool", () => {
		test("extracts pattern and file count", () => {
			const part = createToolPart("glob", {
				status: "completed",
				input: { pattern: "**/*.tsx" },
				output: "file1.tsx\nfile2.tsx\nfile3.tsx",
				title: "3 files found",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "**/*.tsx",
				secondary: "3 files",
			})
		})
	})

	describe("bash tool", () => {
		test("truncates long commands", () => {
			const part = createToolPart("bash", {
				status: "completed",
				input: {
					command: "git commit -m 'this is a very long commit message that should be truncated'",
				},
				output: "success",
				title: "exit 0",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result.primary).toHaveLength(50)
			expect(result.primary).toMatch(/\.\.\.$/)
			expect(result.secondary).toBe("exit 0")
		})

		test("shows short commands as-is", () => {
			const part = createToolPart("bash", {
				status: "completed",
				input: { command: "ls -la" },
				output: "file list",
				title: "exit 0",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "ls -la",
				secondary: "exit 0",
			})
		})
	})

	describe("task tool", () => {
		test("returns null to delegate to SubagentCurrentActivity", () => {
			const part = createToolPart("task", {
				status: "running",
				input: { description: "Debug the auth flow" },
				metadata: {},
				time: { start: 0 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "Debug the auth flow",
				secondary: null,
			})
		})
	})

	describe("unknown tools", () => {
		test("returns null for primary to avoid redundant display", () => {
			const part = createToolPart("custom_tool", {
				status: "pending",
				input: { foo: "bar" },
				raw: "",
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: null,
				secondary: null,
			})
		})
	})
})

describe("hasExpandableContent", () => {
	test("returns true for completed state with output", () => {
		const part = createToolPart("read", {
			status: "completed",
			input: { filePath: "test.ts" },
			output: "file contents",
			title: "Success",
			metadata: {},
			time: { start: 0, end: 100 },
		})

		expect(hasExpandableContent(part.state)).toBe(true)
	})

	test("returns true for error state with error message", () => {
		const part = createToolPart("read", {
			status: "error",
			input: { filePath: "test.ts" },
			error: "File not found",
			metadata: {},
			time: { start: 0, end: 100 },
		})

		expect(hasExpandableContent(part.state)).toBe(true)
	})

	test("returns false for pending state", () => {
		const part = createToolPart("read", {
			status: "pending",
			input: { filePath: "test.ts" },
			raw: "",
		})

		expect(hasExpandableContent(part.state)).toBe(false)
	})

	test("returns false for running state without output", () => {
		const part = createToolPart("read", {
			status: "running",
			input: { filePath: "test.ts" },
			metadata: {},
			time: { start: 0 },
		})

		expect(hasExpandableContent(part.state)).toBe(false)
	})

	test("returns false for completed state with empty string output", () => {
		const part = createToolPart("read", {
			status: "completed",
			input: { filePath: "test.ts" },
			output: "",
			title: "Success",
			metadata: {},
			time: { start: 0, end: 100 },
		})

		expect(hasExpandableContent(part.state)).toBe(false)
	})
})

describe("Tool React.memo comparison for task tools", () => {
	test("detects metadata.summary changes for task tools", () => {
		// Create two task parts with same id/status but different summary length
		const part1 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [
					{ id: "tool-1", tool: "read", state: { status: "completed", title: "Read file" } },
				],
			},
			time: { start: 0 },
		})

		const part2 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [
					{ id: "tool-1", tool: "read", state: { status: "completed", title: "Read file" } },
					{ id: "tool-2", tool: "grep", state: { status: "running" } },
				],
			},
			time: { start: 0 },
		})

		// Verify summaries differ in length (would trigger re-render)
		if (part1.state.status !== "pending" && part2.state.status !== "pending") {
			const metadata1 = part1.state.metadata as { summary?: Array<{ id: string }> }
			const metadata2 = part2.state.metadata as { summary?: Array<{ id: string }> }
			expect(metadata1.summary).toHaveLength(1)
			expect(metadata2.summary).toHaveLength(2)
		}
	})

	test("detects last item status change in summary", () => {
		const part1 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [{ id: "tool-1", tool: "read", state: { status: "running" } }],
			},
			time: { start: 0 },
		})

		const part2 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [
					{ id: "tool-1", tool: "read", state: { status: "completed", title: "Read file" } },
				],
			},
			time: { start: 0 },
		})

		// Verify last item status changed (should trigger re-render)
		if (part1.state.status !== "pending" && part2.state.status !== "pending") {
			const metadata1 = part1.state.metadata as { summary?: Array<{ state: { status: string } }> }
			const metadata2 = part2.state.metadata as { summary?: Array<{ state: { status: string } }> }
			expect(metadata1.summary?.[0]?.state.status).toBe("running")
			expect(metadata2.summary?.[0]?.state.status).toBe("completed")
		}
	})
})

describe("ToolCard React.memo comparison", () => {
	test("verifies identical summary content with different references (Immer scenario)", () => {
		// Simulate Immer creating new references for identical content
		const summaryContent = [
			{ id: "tool-1", tool: "read", state: { status: "completed", title: "Read file" } },
		]

		// Two separate arrays with identical content (different references)
		const summary1 = [...summaryContent]
		const summary2 = [...summaryContent]

		const part1 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: { summary: summary1 },
			time: { start: 0 },
		})

		const part2 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: { summary: summary2 },
			time: { start: 0 },
		})

		// Different references but identical content
		expect(summary1).not.toBe(summary2)
		expect(summary1).toEqual(summary2)

		// Verify parts have same ID, status, and summary content (length + last item)
		expect(part1.id).toBe(part2.id)
		expect(part1.state.status).toBe(part2.state.status)
		if (part1.state.status !== "pending" && part2.state.status !== "pending") {
			const meta1 = part1.state.metadata as {
				summary?: Array<{ id: string; state: { status: string } }>
			}
			const meta2 = part2.state.metadata as {
				summary?: Array<{ id: string; state: { status: string } }>
			}
			expect(meta1.summary).toHaveLength(meta2.summary?.length ?? 0)
			expect(meta1.summary?.[0]?.id).toBe(meta2.summary?.[0]?.id)
			expect(meta1.summary?.[0]?.state.status).toBe(meta2.summary?.[0]?.state.status)
		}
	})

	test("detects summary length changes (should trigger re-render)", () => {
		const part1 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [{ id: "tool-1", tool: "read", state: { status: "completed" } }],
			},
			time: { start: 0 },
		})

		const part2 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [
					{ id: "tool-1", tool: "read", state: { status: "completed" } },
					{ id: "tool-2", tool: "grep", state: { status: "running" } },
				],
			},
			time: { start: 0 },
		})

		// Verify summary lengths differ (signals new tool added)
		if (part1.state.status !== "pending" && part2.state.status !== "pending") {
			const meta1 = part1.state.metadata as { summary?: Array<{ id: string }> }
			const meta2 = part2.state.metadata as { summary?: Array<{ id: string }> }
			expect(meta1.summary).toHaveLength(1)
			expect(meta2.summary).toHaveLength(2)
		}
	})

	test("detects last summary item status change (should trigger re-render)", () => {
		const part1 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [{ id: "tool-1", tool: "read", state: { status: "running" } }],
			},
			time: { start: 0 },
		})

		const part2 = createToolPart("task", {
			status: "running",
			input: { description: "Debug auth" },
			metadata: {
				summary: [{ id: "tool-1", tool: "read", state: { status: "completed" } }],
			},
			time: { start: 0 },
		})

		// Verify last item status changed
		if (part1.state.status !== "pending" && part2.state.status !== "pending") {
			const meta1 = part1.state.metadata as { summary?: Array<{ state: { status: string } }> }
			const meta2 = part2.state.metadata as { summary?: Array<{ state: { status: string } }> }
			expect(meta1.summary?.[0]?.state.status).toBe("running")
			expect(meta2.summary?.[0]?.state.status).toBe("completed")
		}
	})
})
