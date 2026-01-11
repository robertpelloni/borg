import { describe, test, expect, beforeEach } from "vitest"
import { usePromptStore } from "./prompt-store"
import type { Prompt, SlashCommand } from "../types/prompt"

describe("usePromptStore", () => {
	beforeEach(() => {
		// Reset store before each test
		usePromptStore.getState().reset()
	})

	describe("initial state", () => {
		test("should have default empty text part", () => {
			const state = usePromptStore.getState()
			expect(state.parts).toEqual([{ type: "text", content: "", start: 0, end: 0 }])
		})

		test("should have cursor at 0", () => {
			const state = usePromptStore.getState()
			expect(state.cursor).toBe(0)
		})

		test("should have autocomplete hidden", () => {
			const state = usePromptStore.getState()
			expect(state.autocomplete.visible).toBe(false)
			expect(state.autocomplete.type).toBe(null)
			expect(state.autocomplete.query).toBe("")
			expect(state.autocomplete.items).toEqual([])
			expect(state.autocomplete.selectedIndex).toBe(0)
		})
	})

	describe("setParts", () => {
		test("should update parts", () => {
			const newParts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]

			usePromptStore.getState().setParts(newParts)

			const state = usePromptStore.getState()
			expect(state.parts).toEqual(newParts)
		})

		test("should update cursor when provided", () => {
			const newParts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]

			usePromptStore.getState().setParts(newParts, 5)

			const state = usePromptStore.getState()
			expect(state.cursor).toBe(5)
		})

		test("should preserve cursor when not provided", () => {
			usePromptStore.setState({ cursor: 10 })
			const newParts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]

			usePromptStore.getState().setParts(newParts)

			const state = usePromptStore.getState()
			expect(state.cursor).toBe(10)
		})
	})

	describe("insertFilePart", () => {
		test("should insert file part at position", () => {
			// Setup: "Hello world"
			const initialParts: Prompt = [{ type: "text", content: "Hello world", start: 0, end: 11 }]
			usePromptStore.getState().setParts(initialParts)

			// Insert @src/app.ts at position 6, replacing 0 chars
			usePromptStore.getState().insertFilePart("src/app.ts", 6, 0)

			const state = usePromptStore.getState()
			expect(state.parts).toHaveLength(3)
			expect(state.parts[0]).toEqual({
				type: "text",
				content: "Hello ",
				start: 0,
				end: 6,
			})
			expect(state.parts[1]).toEqual({
				type: "file",
				path: "src/app.ts",
				content: "@src/app.ts",
				start: 6,
				end: 17,
			})
			expect(state.parts[2]).toEqual({
				type: "text",
				content: " world",
				start: 17,
				end: 23,
			})
		})

		test("should replace characters when replaceLength > 0", () => {
			// Setup: "Hello @src world"
			const initialParts: Prompt = [
				{ type: "text", content: "Hello @src world", start: 0, end: 16 },
			]
			usePromptStore.getState().setParts(initialParts)

			// Replace "@src" (4 chars) at position 10 with file part
			usePromptStore.getState().insertFilePart("src/app.ts", 10, 4)

			const state = usePromptStore.getState()
			expect(state.parts).toHaveLength(3)
			expect(state.parts[0]).toEqual({
				type: "text",
				content: "Hello ",
				start: 0,
				end: 6,
			})
			expect(state.parts[1]).toEqual({
				type: "file",
				path: "src/app.ts",
				content: "@src/app.ts",
				start: 6,
				end: 17,
			})
			expect(state.parts[2]).toEqual({
				type: "text",
				content: "  world", // Space is added before after text
				start: 17,
				end: 24,
			})
		})

		test("should add space after file part when no trailing text", () => {
			// Setup: "Hello"
			const initialParts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]
			usePromptStore.getState().setParts(initialParts)

			// Insert file part at end
			usePromptStore.getState().insertFilePart("src/app.ts", 5, 0)

			const state = usePromptStore.getState()
			expect(state.parts).toHaveLength(3)
			expect(state.parts[2]).toEqual({
				type: "text",
				content: " ",
				start: 16,
				end: 17,
			})
		})

		test("should handle insertion at start", () => {
			const initialParts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]
			usePromptStore.getState().setParts(initialParts)

			usePromptStore.getState().insertFilePart("src/app.ts", 0, 0)

			const state = usePromptStore.getState()
			expect(state.parts[0]).toEqual({
				type: "file",
				path: "src/app.ts",
				content: "@src/app.ts",
				start: 0,
				end: 11,
			})
		})

		test("should handle empty initial content", () => {
			// Default state has empty text part
			usePromptStore.getState().insertFilePart("src/app.ts", 0, 0)

			const state = usePromptStore.getState()
			expect(state.parts).toHaveLength(2)
			expect(state.parts[0]).toEqual({
				type: "file",
				path: "src/app.ts",
				content: "@src/app.ts",
				start: 0,
				end: 11,
			})
			expect(state.parts[1]).toEqual({
				type: "text",
				content: " ",
				start: 11,
				end: 12,
			})
		})

		test("should update cursor position after insertion", () => {
			// Setup: "Hello world"
			const initialParts: Prompt = [{ type: "text", content: "Hello world", start: 0, end: 11 }]
			usePromptStore.getState().setParts(initialParts, 6)

			// Insert @src/app.ts at position 6, replacing 0 chars
			usePromptStore.getState().insertFilePart("src/app.ts", 6, 0)

			const state = usePromptStore.getState()
			// Cursor should be at end of file part + trailing space
			// "Hello " (6) + "@src/app.ts" (11) + " " (1) = 18
			expect(state.cursor).toBe(18)
		})

		test("should update cursor position when replacing text", () => {
			// Setup: "Hello @src world"
			const initialParts: Prompt = [
				{ type: "text", content: "Hello @src world", start: 0, end: 16 },
			]
			usePromptStore.getState().setParts(initialParts, 10)

			// Replace "@src" (4 chars) at position 10 with file part
			usePromptStore.getState().insertFilePart("src/app.ts", 10, 4)

			const state = usePromptStore.getState()
			// Cursor should be at: "Hello " (6) + "@src/app.ts" (11) + " " (1) = 18
			expect(state.cursor).toBe(18)
		})

		test("should update cursor position at start", () => {
			const initialParts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]
			usePromptStore.getState().setParts(initialParts, 0)

			usePromptStore.getState().insertFilePart("src/app.ts", 0, 0)

			const state = usePromptStore.getState()
			// Cursor should be at end of file part + trailing space
			// "@src/app.ts" (11) + " " (1) = 12
			expect(state.cursor).toBe(12)
		})
	})

	describe("autocomplete actions", () => {
		describe("showAutocomplete", () => {
			test("should show file autocomplete", () => {
				usePromptStore.getState().showAutocomplete("file", "src")

				const state = usePromptStore.getState()
				expect(state.autocomplete.visible).toBe(true)
				expect(state.autocomplete.type).toBe("file")
				expect(state.autocomplete.query).toBe("src")
				expect(state.autocomplete.items).toEqual([])
				expect(state.autocomplete.selectedIndex).toBe(0)
			})

			test("should show command autocomplete", () => {
				usePromptStore.getState().showAutocomplete("command", "new")

				const state = usePromptStore.getState()
				expect(state.autocomplete.visible).toBe(true)
				expect(state.autocomplete.type).toBe("command")
				expect(state.autocomplete.query).toBe("new")
			})

			test("should reset selectedIndex when showing", () => {
				// Set selectedIndex to non-zero
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "old",
						items: ["a", "b", "c"],
						selectedIndex: 2,
					},
				})

				usePromptStore.getState().showAutocomplete("file", "new")

				const state = usePromptStore.getState()
				expect(state.autocomplete.selectedIndex).toBe(0)
			})
		})

		describe("hideAutocomplete", () => {
			test("should hide autocomplete and reset state", () => {
				// Setup visible autocomplete
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: ["src/app.ts"],
						selectedIndex: 0,
					},
				})

				usePromptStore.getState().hideAutocomplete()

				const state = usePromptStore.getState()
				expect(state.autocomplete.visible).toBe(false)
				expect(state.autocomplete.type).toBe(null)
				expect(state.autocomplete.query).toBe("")
				expect(state.autocomplete.items).toEqual([])
				expect(state.autocomplete.selectedIndex).toBe(0)
			})
		})

		describe("setAutocompleteItems", () => {
			test("should update file items", () => {
				usePromptStore.getState().showAutocomplete("file", "src")
				const items = ["src/app.ts", "src/index.ts"]

				usePromptStore.getState().setAutocompleteItems(items)

				const state = usePromptStore.getState()
				expect(state.autocomplete.items).toEqual(items)
			})

			test("should update command items", () => {
				usePromptStore.getState().showAutocomplete("command", "new")
				const items: SlashCommand[] = [
					{
						id: "session.new",
						trigger: "new",
						title: "New Session",
						type: "builtin",
					},
				]

				usePromptStore.getState().setAutocompleteItems(items)

				const state = usePromptStore.getState()
				expect(state.autocomplete.items).toEqual(items)
			})

			test("should preserve other autocomplete state", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: [],
						selectedIndex: 0,
					},
				})

				usePromptStore.getState().setAutocompleteItems(["src/app.ts"])

				const state = usePromptStore.getState()
				expect(state.autocomplete.visible).toBe(true)
				expect(state.autocomplete.type).toBe("file")
				expect(state.autocomplete.query).toBe("src")
			})
		})

		describe("setAutocompleteIndex", () => {
			test("should set selected index", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: ["a", "b", "c"],
						selectedIndex: 0,
					},
				})

				usePromptStore.getState().setAutocompleteIndex(2)

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(2)
			})

			test("should preserve other autocomplete state", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "command",
						query: "new",
						items: ["a", "b", "c"],
						selectedIndex: 0,
					},
				})

				usePromptStore.getState().setAutocompleteIndex(1)

				const state = usePromptStore.getState()
				expect(state.autocomplete.visible).toBe(true)
				expect(state.autocomplete.type).toBe("command")
				expect(state.autocomplete.query).toBe("new")
				expect(state.autocomplete.items).toEqual(["a", "b", "c"])
			})
		})

		describe("navigateAutocomplete", () => {
			test("should navigate down", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: ["a", "b", "c"],
						selectedIndex: 0,
					},
				})

				usePromptStore.getState().navigateAutocomplete("down")

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(1)

				usePromptStore.getState().navigateAutocomplete("down")

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(2)
			})

			test("should not navigate down past last item", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: ["a", "b", "c"],
						selectedIndex: 2,
					},
				})

				usePromptStore.getState().navigateAutocomplete("down")

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(2)
			})

			test("should navigate up", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: ["a", "b", "c"],
						selectedIndex: 2,
					},
				})

				usePromptStore.getState().navigateAutocomplete("up")

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(1)

				usePromptStore.getState().navigateAutocomplete("up")

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(0)
			})

			test("should not navigate up past first item", () => {
				usePromptStore.setState({
					autocomplete: {
						visible: true,
						type: "file",
						query: "src",
						items: ["a", "b", "c"],
						selectedIndex: 0,
					},
				})

				usePromptStore.getState().navigateAutocomplete("up")

				expect(usePromptStore.getState().autocomplete.selectedIndex).toBe(0)
			})
		})
	})

	describe("reset", () => {
		test("should reset all state to defaults", () => {
			// Mutate state
			usePromptStore.setState({
				parts: [
					{ type: "text", content: "Hello", start: 0, end: 5 },
					{
						type: "file",
						path: "src/app.ts",
						content: "@src/app.ts",
						start: 5,
						end: 16,
					},
				],
				cursor: 10,
				autocomplete: {
					visible: true,
					type: "file",
					query: "src",
					items: ["src/app.ts"],
					selectedIndex: 0,
				},
			})

			usePromptStore.getState().reset()

			const state = usePromptStore.getState()
			expect(state.parts).toEqual([{ type: "text", content: "", start: 0, end: 0 }])
			expect(state.cursor).toBe(0)
			expect(state.autocomplete).toEqual({
				visible: false,
				type: null,
				query: "",
				items: [],
				selectedIndex: 0,
			})
		})
	})

	describe("selector stability patterns", () => {
		test("whole-store pattern creates stable reference via getState()", () => {
			// This pattern is CORRECT for stores
			// getState() always returns the same reference until state changes
			const state1 = usePromptStore.getState()
			const state2 = usePromptStore.getState()

			// Same reference if no state changes
			expect(state1).toBe(state2)

			// Actions are also stable references
			expect(state1.setParts).toBe(state2.setParts)
			expect(state1.reset).toBe(state2.reset)
		})

		test("store actions can be used in effects without dependency warnings", () => {
			// This pattern is CORRECT for calling actions in effects
			// Actions are stable - won't cause infinite loops
			const callCount = { value: 0 }
			const mockEffect = () => {
				callCount.value++
				// Safe to call in effect - getState() actions are stable
				const actions = usePromptStore.getState()
				actions.setParts([{ type: "text", content: "test", start: 0, end: 4 }])
			}

			mockEffect()
			mockEffect()

			// Called twice, but actions didn't change
			expect(callCount.value).toBe(2)
			const firstPart = usePromptStore.getState().parts[0]
			expect(firstPart?.type).toBe("text")
			if (firstPart?.type === "text") {
				expect(firstPart.content).toBe("test")
			}
		})

		test("whole-store destructuring pattern is safe when component needs all state", () => {
			// This pattern is used in PromptInput.tsx - CORRECT for this use case
			// Component re-renders on ANY state change (needs parts, cursor, autocomplete)

			const initialState = usePromptStore.getState()
			const { parts: parts1, cursor: cursor1, autocomplete: autocomplete1, setParts } = initialState

			// Update state
			setParts([{ type: "text", content: "changed", start: 0, end: 7 }])

			const newState = usePromptStore.getState()
			const { parts: parts2, cursor: cursor2, autocomplete: autocomplete2 } = newState

			// Parts changed (new reference)
			expect(parts1).not.toBe(parts2)
			const newPart = parts2[0]
			expect(newPart?.type).toBe("text")
			if (newPart?.type === "text") {
				expect(newPart.content).toBe("changed")
			}

			// Cursor unchanged (same value)
			expect(cursor1).toBe(cursor2)

			// Autocomplete unchanged (same reference)
			expect(autocomplete1).toBe(autocomplete2)
		})
	})
})
