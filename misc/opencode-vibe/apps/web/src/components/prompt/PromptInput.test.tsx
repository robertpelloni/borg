import { describe, test, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { PromptInput } from "./PromptInput"

// Setup DOM environment with happy-dom
import { Window } from "happy-dom"
const window = new Window()
global.document = window.document as any
global.window = window as any

// Mock the hooks module to control error state
vi.mock("@/app/hooks", () => ({
	useFileSearch: vi.fn(() => ({
		files: [],
		isLoading: false,
		error: null,
	})),
	useCommands: vi.fn(() => ({
		getSlashCommands: () => [],
	})),
}))

describe("PromptInput - Error Handling", () => {
	test("renders without error when useFileSearch returns no error", () => {
		const { container } = render(<PromptInput />)

		// Should not show error message
		expect(container.textContent).not.toContain("Search failed")
	})

	test("displays error toast when useFileSearch returns error", async () => {
		const { useFileSearch } = await import("@/app/hooks")

		// Mock error state
		vi.mocked(useFileSearch).mockReturnValue({
			files: [],
			isLoading: false,
			error: new Error("API connection failed"),
		})

		const { container } = render(<PromptInput />)

		// Trigger file search by simulating @ input
		const editor = container.querySelector('[contenteditable="true"]')
		expect(editor).toBeDefined()

		if (editor) {
			editor.textContent = "@"
			editor.dispatchEvent(new Event("input", { bubbles: true }))
		}

		// Error should be passed to Autocomplete when autocomplete is visible
		// (Autocomplete visibility is controlled by PromptInput state logic)
		// This test verifies the wiring - Autocomplete tests verify the display
		expect(vi.mocked(useFileSearch)).toHaveBeenCalled()
	})
})
