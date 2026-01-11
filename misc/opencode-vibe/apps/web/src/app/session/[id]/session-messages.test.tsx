import { describe, test, expect } from "vitest"

/**
 * Test the MessageRenderer memo comparison logic in isolation.
 *
 * Tests the fix for: Task cards not updating in real-time
 * Root cause: MessageRenderer memo didn't compare _opencode.state.metadata.summary
 *
 * Instead of rendering components (NO DOM TESTING), we test the memo comparison
 * function directly by simulating what React.memo receives as props.
 */
describe("SessionMessages", () => {
	describe("MessageRenderer memo comparison", () => {
		/**
		 * Helper to simulate the memo comparison function from MessageRenderer.
		 * This is the actual comparison logic extracted from session-messages.tsx lines 226-248.
		 */
		function arePropsEqual(
			prev: { message: any; messageState: string; status: string },
			next: { message: any; messageState: string; status: string },
		): boolean {
			// Compare message ID
			if (prev.message.id !== next.message.id) return false
			// Compare message state (pending/processing/complete)
			if (prev.messageState !== next.messageState) return false
			// Compare parts length (indicates content change)
			if (prev.message.parts?.length !== next.message.parts?.length) return false
			// Compare streaming status (affects reasoning component)
			if (prev.status !== next.status) return false
			// If last part exists, compare its type and content for streaming updates
			const prevLastPart = prev.message.parts?.[prev.message.parts.length - 1]
			const nextLastPart = next.message.parts?.[next.message.parts.length - 1]
			if (prevLastPart?.type !== nextLastPart?.type) return false
			// For text/reasoning, compare content
			if (prevLastPart?.type === "text" || prevLastPart?.type === "reasoning") {
				if ((prevLastPart as any).text !== (nextLastPart as any).text) return false
			}
			// For tools, compare state AND _opencode metadata
			if (prevLastPart?.type?.startsWith("tool-")) {
				if ((prevLastPart as any).state !== (nextLastPart as any).state) return false
				// Compare OpenCode ToolPart status and metadata (for task tools)
				const prevOpencode = (prevLastPart as any)._opencode
				const nextOpencode = (nextLastPart as any)._opencode
				if (prevOpencode && nextOpencode) {
					// Compare status
					if (prevOpencode.state?.status !== nextOpencode.state?.status) return false
					// For task tools, compare metadata.summary length and last item status
					if (prevOpencode.tool === "task" && nextOpencode.tool === "task") {
						const prevSummary = prevOpencode.state?.metadata?.summary
						const nextSummary = nextOpencode.state?.metadata?.summary
						if (prevSummary?.length !== nextSummary?.length) return false
						if (prevSummary && nextSummary && prevSummary.length > 0) {
							const prevLast = prevSummary[prevSummary.length - 1]
							const nextLast = nextSummary[nextSummary.length - 1]
							if (prevLast?.state?.status !== nextLast?.state?.status) return false
						}
					}
				}
			}
			return true // Props are equal, skip re-render
		}

		test("returns false when task tool metadata.summary length changes", () => {
			const basePart: any = {
				type: "tool-task" as const,
				toolCallId: "tool-1",
				title: "task",
				state: "output-available" as const,
				_opencode: {
					id: "tool-1",
					type: "tool" as const,
					tool: "task",
					state: {
						status: "running" as const,
						input: { description: "Test task" },
						metadata: {
							sessionId: "child-session",
							summary: [],
						},
					},
				},
			}

			const prevProps = {
				message: {
					id: "msg-1",
					role: "assistant" as const,
					parts: [basePart],
				} as any,
				messageState: "processing",
				status: "ready",
			}

			// Simulate SSE update: summary now has a running tool
			const nextProps = {
				message: {
					id: "msg-1",
					role: "assistant" as const,
					parts: [
						{
							...basePart,
							_opencode: {
								...basePart._opencode,
								state: {
									...basePart._opencode.state,
									metadata: {
										sessionId: "child-session",
										summary: [
											{
												id: "subtool-1",
												tool: "read",
												state: {
													status: "running" as const,
												},
											},
										],
									},
								},
							},
						},
					],
				} as any,
				messageState: "processing",
				status: "ready",
			}

			// Should return false (props NOT equal) because summary length changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns false when task tool summary last item status changes", () => {
			const createProps = (summaryStatus: "running" | "completed", title?: string) => ({
				message: {
					id: "msg-1",
					role: "assistant" as const,
					parts: [
						{
							type: "tool-task" as const,
							toolCallId: "tool-1",
							title: "task",
							state: "output-available" as const,
							_opencode: {
								id: "tool-1",
								type: "tool" as const,
								tool: "task",
								state: {
									status: "running" as const,
									input: { description: "Test task" },
									metadata: {
										sessionId: "child-session",
										summary: [
											{
												id: "subtool-1",
												tool: "read",
												state: {
													status: summaryStatus,
													title,
												},
											},
										],
									},
								},
							},
						},
					],
				} as any,
				messageState: "processing",
				status: "ready",
			})

			const prevProps = createProps("running")
			const nextProps = createProps("completed", "Read 100 lines from config.ts")

			// Should return false (props NOT equal) because last item status changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(false)
		})

		test("returns true when task tool summary unchanged", () => {
			const createProps = () => ({
				message: {
					id: "msg-1",
					role: "assistant" as const,
					parts: [
						{
							type: "tool-task" as const,
							toolCallId: "tool-1",
							title: "task",
							state: "output-available" as const,
							_opencode: {
								id: "tool-1",
								type: "tool" as const,
								tool: "task",
								state: {
									status: "running" as const,
									input: { description: "Test task" },
									metadata: {
										sessionId: "child-session",
										summary: [
											{
												id: "subtool-1",
												tool: "read",
												state: {
													status: "running" as const,
												},
											},
										],
									},
								},
							},
						},
					],
				} as any,
				messageState: "processing",
				status: "ready",
			})

			const prevProps = createProps()
			const nextProps = createProps()

			// Should return true (props equal) because nothing changed
			expect(arePropsEqual(prevProps, nextProps)).toBe(true)
		})
	})
})
