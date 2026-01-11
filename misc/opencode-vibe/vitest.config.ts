import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/.swarm/**"],
		setupFiles: ["./vitest.setup.ts"],
		isolate: true,
		pool: "forks",
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./apps/web/src"),
			"@opencode-vibe/router": path.resolve(__dirname, "./packages/router/src"),
			"@opencode-vibe/react": path.resolve(__dirname, "./packages/react/src"),
		},
		extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
	},
	esbuild: {
		// Handle .js extensions in imports (ESM convention)
		target: "esnext",
	},
})
