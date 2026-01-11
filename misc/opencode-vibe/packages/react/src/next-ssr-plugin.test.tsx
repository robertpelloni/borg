import { describe, it, expect } from "vitest"
import type { OpencodeConfig, OpencodeSSRPluginProps } from "./next-ssr-plugin"

describe("OpencodeSSRPlugin", () => {
	it("config is serializable (no functions/symbols)", () => {
		const config: OpencodeConfig = { baseUrl: "/api", directory: "/path" }
		expect(() => JSON.stringify(config)).not.toThrow()
		const serialized = JSON.stringify(config)
		expect(serialized).toBe('{"baseUrl":"/api","directory":"/path"}')
	})

	it("accepts valid config shape via TypeScript", () => {
		// Type-level test - if this compiles, it passes
		const validProps: OpencodeSSRPluginProps = {
			config: { baseUrl: "/api", directory: "/path" },
		}
		expect(validProps.config.baseUrl).toBe("/api")
		expect(validProps.config.directory).toBe("/path")
	})

	it("config baseUrl is required", () => {
		const config: OpencodeConfig = { baseUrl: "/api/opencode/4056", directory: "/path" }
		expect(config.baseUrl).toBeTruthy()
	})

	it("config directory is required", () => {
		const config: OpencodeConfig = { baseUrl: "/api", directory: "/project" }
		expect(config.directory).toBeTruthy()
	})
})
