import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { FilePill } from "./FilePill"

// Setup DOM environment with happy-dom
import { Window } from "happy-dom"
const window = new Window()
global.document = window.document as any
global.window = window as any

describe("FilePill", () => {
	it("renders with path as @filename format", () => {
		const { container } = render(<FilePill path="src/app/page.tsx" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill?.textContent).toBe("@src/app/page.tsx")
	})

	it("has contentEditable=false to prevent editing", () => {
		const { container } = render(<FilePill path="test.ts" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill?.getAttribute("contenteditable")).toBe("false")
	})

	it("has data-type attribute set to file", () => {
		const { container } = render(<FilePill path="test.ts" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill).toBeDefined()
	})

	it("has data-path attribute with the file path", () => {
		const { container } = render(<FilePill path="src/components/Button.tsx" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill?.getAttribute("data-path")).toBe("src/components/Button.tsx")
	})

	it("renders as a span element", () => {
		const { container } = render(<FilePill path="test.ts" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill?.tagName).toBe("SPAN")
	})

	it("applies default styling classes", () => {
		const { container } = render(<FilePill path="test.ts" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill?.className).toContain("text-blue-500")
		expect(pill?.className).toContain("cursor-default")
		expect(pill?.className).toContain("inline-flex")
	})

	it("merges custom className with default classes", () => {
		const { container } = render(<FilePill path="test.ts" className="custom-class" />)
		const pill = container.querySelector('[data-type="file"]')
		expect(pill?.className).toContain("text-blue-500")
		expect(pill?.className).toContain("custom-class")
	})
})
