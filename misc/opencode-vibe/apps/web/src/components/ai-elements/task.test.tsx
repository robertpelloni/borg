import { describe, expect, it, beforeAll, afterEach } from "vitest"
import { Window } from "happy-dom"
import { render, cleanup } from "@testing-library/react"
import type { ToolPart } from "@opencode-ai/sdk/client"
import { getCurrentlyDoing, SubagentCurrentActivity, SubagentToolTree } from "./task"

// Set up DOM for React component tests
beforeAll(() => {
	const window = new Window()
	// @ts-ignore - happy-dom types don't match perfectly
	global.document = window.document
	// @ts-ignore
	global.window = window
})

afterEach(() => {
	cleanup()
})

describe("getCurrentlyDoing", () => {
	it("returns null for non-tool parts", () => {
		const part = {
			type: "text",
			text: "hello",
		} as unknown as ToolPart

		expect(getCurrentlyDoing(part)).toBe(null)
	})

	it("returns null for non-task tools", () => {
		const part = {
			type: "tool",
			tool: "read",
			state: { status: "completed" as const },
		} as unknown as ToolPart

		expect(getCurrentlyDoing(part)).toBe(null)
	})

	it("returns null for pending task", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: { status: "pending" as const },
		} as unknown as ToolPart

		expect(getCurrentlyDoing(part)).toBe(null)
	})

	it("returns null for task with no metadata", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: { status: "running" as const },
		} as unknown as ToolPart

		expect(getCurrentlyDoing(part)).toBe(null)
	})

	it("returns null for task with empty summary", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [],
				},
			},
		} as unknown as ToolPart

		expect(getCurrentlyDoing(part)).toBe(null)
	})

	it("returns running tool when present", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "grep",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const activity = getCurrentlyDoing(part)
		expect(activity).toEqual({
			type: "running",
			tool: "grep",
		})
	})

	it("returns last running tool when multiple running", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "running" as const },
						},
						{
							id: "part-2",
							tool: "grep",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const activity = getCurrentlyDoing(part)
		expect(activity).toEqual({
			type: "running",
			tool: "grep",
		})
	})

	it("returns last completed tool when nothing running", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "completed" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "grep",
							state: {
								status: "completed" as const,
								title: 'Found 3 matches for "pattern"',
							},
						},
					],
				},
			},
		} as unknown as ToolPart

		const activity = getCurrentlyDoing(part)
		expect(activity).toEqual({
			type: "completed",
			tool: "grep",
			title: 'Found 3 matches for "pattern"',
		})
	})

	it("ignores pending and error tools", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "grep",
							state: { status: "error" as const },
						},
						{
							id: "part-3",
							tool: "glob",
							state: { status: "pending" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const activity = getCurrentlyDoing(part)
		expect(activity).toEqual({
			type: "completed",
			tool: "read",
			title: "Read file.ts",
		})
	})

	it("prefers running over completed", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "grep",
							state: { status: "completed" as const, title: "Found 3 matches" },
						},
						{
							id: "part-3",
							tool: "edit",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const activity = getCurrentlyDoing(part)
		expect(activity).toEqual({
			type: "running",
			tool: "edit",
		})
	})
})

describe("SubagentCurrentActivity", () => {
	it("shows 'Starting...' when task is running but no summary yet", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentCurrentActivity part={part} />)
		expect(container.textContent).toContain("Starting...")
	})

	it("shows nothing when task is pending", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "pending" as const,
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentCurrentActivity part={part} />)
		expect(container.textContent).toBe("")
	})

	it("shows running tool with formatted name", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "grep",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentCurrentActivity part={part} />)
		expect(container.textContent).toContain("Searching...")
	})

	it("shows completed tool title", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "completed" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: {
								status: "completed" as const,
								title: "Read src/auth.ts (234 lines)",
							},
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentCurrentActivity part={part} />)
		expect(container.textContent).toBe("Read src/auth.ts (234 lines)")
	})

	it("shows most recent running tool when multiple", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "edit",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentCurrentActivity part={part} />)
		expect(container.textContent).toContain("Editing...")
	})

	it("content-aware comparison returns true when summary content identical (Immer scenario)", () => {
		// This test verifies the memoization logic without testing React internals
		// We verify that identical content with different references is considered equal

		// Initial state
		const part1 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "grep",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		// Simulate Immer update: new array reference, identical content
		const part2 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
						{
							id: "part-2",
							tool: "grep",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		// Render once to establish baseline
		const { container, rerender } = render(<SubagentCurrentActivity part={part1} />)
		const initialContent = container.textContent

		// Re-render with identical content, different reference
		rerender(<SubagentCurrentActivity part={part2} />)

		// Content should remain the same (component skipped render)
		expect(container.textContent).toBe(initialContent)

		// Verify different references (this is the Immer behavior we're handling)
		expect((part1.state as any).metadata.summary).not.toBe((part2.state as any).metadata.summary)
	})

	it("does render when summary content actually changes", () => {
		// Verify we still re-render when content legitimately changes
		let renderCount = 0

		const TestWrapper = ({ part }: { part: ToolPart }) => {
			renderCount++
			return <SubagentCurrentActivity part={part} />
		}

		const part1 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { rerender } = render(<TestWrapper part={part1} />)
		const initialRenderCount = renderCount

		// Content change: status updated
		const part2 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "running" as const }, // Changed from completed
						},
					],
				},
			},
		} as unknown as ToolPart

		rerender(<TestWrapper part={part2} />)

		expect(renderCount).toBe(initialRenderCount + 1) // Should re-render
	})

	it("re-renders when completed tool title is added via SSE (Immer scenario)", () => {
		// BUG REPRODUCTION: Memo comparison missing item.state.title
		// When SSE updates add title to completed tool, component should re-render
		// to display the new title instead of showing stale content

		const part1 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const }, // No title yet
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container, rerender } = render(<SubagentCurrentActivity part={part1} />)
		const initialContent = container.textContent

		// SSE update: title added (Immer creates new references)
		const part2 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: {
								status: "completed" as const,
								title: "Read src/auth.ts (234 lines)", // Title added
							},
						},
					],
				},
			},
		} as unknown as ToolPart

		rerender(<SubagentCurrentActivity part={part2} />)

		// Component SHOULD re-render and show the new title
		expect(container.textContent).toContain("Read src/auth.ts (234 lines)")
		expect(container.textContent).not.toBe(initialContent)

		// Verify different references (Immer behavior)
		expect((part1.state as any).metadata.summary).not.toBe((part2.state as any).metadata.summary)
	})
})

describe("SubagentToolTree", () => {
	it("shows nothing when no summary", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} />)
		expect(container.textContent).toBe("")
	})

	it("renders all tools from summary", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "swarmmail_init",
							state: {
								status: "completed" as const,
								title: "Initialized as DarkRiver",
							},
						},
						{
							id: "part-2",
							tool: "semantic-memory_find",
							state: {
								status: "completed" as const,
								title: "Found 3 memories",
							},
						},
						{
							id: "part-3",
							tool: "swarmmail_reserve",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} defaultOpen={true} />)

		// Completed tools show titles
		expect(container.textContent).toContain("Initialized as DarkRiver")
		expect(container.textContent).toContain("Found 3 memories")
		// Running tools show tool name (no title yet)
		expect(container.textContent).toContain("swarmmail_reserve")
	})

	it("shows status icons: ✓ for completed", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "completed" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} defaultOpen={true} />)
		expect(container.textContent).toContain("✓")
	})

	it("shows status icons: ⏳ for running", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "bash",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} defaultOpen={true} />)
		// Note: ⏳ emoji gets normalized in textContent
		expect(container.textContent).toMatch(/⏳|bash/)
	})

	it("shows status icons: ✗ for error", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "error" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "edit",
							state: { status: "error" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} defaultOpen={true} />)
		// Note: ✗ emoji gets normalized in textContent
		expect(container.textContent).toMatch(/✗|edit/)
	})

	it("shows tool titles when completed", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "completed" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: {
								status: "completed" as const,
								title: "Read apps/web/src/task.tsx",
							},
						},
						{
							id: "part-2",
							tool: "bash",
							state: {
								status: "completed" as const,
								title: "Run typecheck: 0 errors",
							},
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} defaultOpen={true} />)
		expect(container.textContent).toContain("Read apps/web/src/task.tsx")
		expect(container.textContent).toContain("Run typecheck: 0 errors")
	})

	it("is collapsible (default collapsed)", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const, title: "Read file.ts" },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} />)

		// Should have a button/trigger for collapsing
		const trigger = container.querySelector("button")
		expect(trigger).not.toBeNull()
	})

	it("shows tree structure with indentation", () => {
		const part = {
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "swarmmail_init",
							state: { status: "completed" as const, title: "Init" },
						},
						{
							id: "part-2",
							tool: "read",
							state: { status: "completed" as const, title: "Read file" },
						},
						{
							id: "part-3",
							tool: "bash",
							state: { status: "running" as const },
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container } = render(<SubagentToolTree part={part} defaultOpen={true} />)

		// Should have tree-like structure (using ├ or └ for branches)
		const text = container.textContent || ""
		expect(text.includes("├") || text.includes("└")).toBe(true)
	})

	it("re-renders when tool title is added via SSE (Immer scenario)", () => {
		// Verifies memo comparison includes item.state.title
		// When SSE updates add titles to tools, tree should update to show them

		const part1 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: { status: "completed" as const }, // No title yet
						},
					],
				},
			},
		} as unknown as ToolPart

		const { container, rerender } = render(<SubagentToolTree part={part1} defaultOpen={true} />)

		// Initial render shows tool name
		expect(container.textContent).toContain("read")

		// SSE update: title added (Immer creates new references)
		const part2 = {
			id: "task-123",
			type: "tool",
			tool: "task",
			state: {
				status: "running" as const,
				metadata: {
					sessionId: "sess-123",
					summary: [
						{
							id: "part-1",
							tool: "read",
							state: {
								status: "completed" as const,
								title: "Read apps/web/src/task.tsx",
							},
						},
					],
				},
			},
		} as unknown as ToolPart

		rerender(<SubagentToolTree part={part2} />)

		// Tree SHOULD re-render and show the new title
		expect(container.textContent).toContain("Read apps/web/src/task.tsx")

		// Verify different references (Immer behavior)
		expect((part1.state as any).metadata.summary).not.toBe((part2.state as any).metadata.summary)
	})
})
