import { describe, test, expect } from "vitest"
import { render } from "@testing-library/react"
import { Autocomplete } from "./Autocomplete"

// Setup DOM environment with happy-dom
import { Window } from "happy-dom"
const window = new Window()
global.document = window.document as any
global.window = window as any

describe("Autocomplete", () => {
	test("displays error message when error prop is provided", () => {
		const error = new Error("Network request failed")

		const { container } = render(
			<Autocomplete
				type="file"
				items={[]}
				selectedIndex={0}
				onSelect={() => {}}
				error={error}
				visible={true}
			/>,
		)

		expect(container.textContent).toContain("Search failed")
		expect(container.textContent).toContain("Network request failed")
	})

	test("displays error with warning icon and destructive styling", () => {
		const error = new Error("Connection timeout")

		const { container } = render(
			<Autocomplete
				type="file"
				items={[]}
				selectedIndex={0}
				onSelect={() => {}}
				error={error}
				visible={true}
			/>,
		)

		expect(container.textContent).toContain("⚠️")
		expect(container.querySelector(".text-destructive")).toBeDefined()
	})

	test("shows items when no error", () => {
		const { container } = render(
			<Autocomplete
				type="file"
				items={["src/app.ts", "src/test.ts"]}
				selectedIndex={0}
				onSelect={() => {}}
				visible={true}
			/>,
		)

		expect(container.textContent).toContain("app.ts")
		expect(container.textContent).toContain("test.ts")
		expect(container.textContent).not.toContain("Search failed")
	})

	test("error takes precedence over loading state", () => {
		const error = new Error("Failed to fetch")

		const { container } = render(
			<Autocomplete
				type="file"
				items={[]}
				selectedIndex={0}
				onSelect={() => {}}
				error={error}
				isLoading={true}
				visible={true}
			/>,
		)

		expect(container.textContent).toContain("Search failed")
		expect(container.textContent).not.toContain("Searching...")
	})

	test("shows 'No files found' when no error and no items", () => {
		const { container } = render(
			<Autocomplete type="file" items={[]} selectedIndex={0} onSelect={() => {}} visible={true} />,
		)

		expect(container.textContent).toContain("No files found")
		expect(container.textContent).not.toContain("Search failed")
	})

	test("does not render when visible is false", () => {
		const error = new Error("Test error")

		const { container } = render(
			<Autocomplete
				type="file"
				items={[]}
				selectedIndex={0}
				onSelect={() => {}}
				error={error}
				visible={false}
			/>,
		)

		expect(container.firstChild).toBeNull()
	})
})
