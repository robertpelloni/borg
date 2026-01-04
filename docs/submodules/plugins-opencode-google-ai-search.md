# Opencode Google AI Search Plugin

An Opencode plugin that exposes a native tool (`google_ai_search_plus`) for querying Google AI Mode (aka Google SGE). It uses Playwright to load the AI panel directly and converts the full response into markdown with Turndown so the output renders just like the built-in `webfetch` tool.

## Features

- Direct navigation to Google AI Mode with stealth browser headers.
- Waits for the progressive response to stabilise before extraction.
- Captures headings, lists, tables, and sources from the AI panel.
- Converts the response to markdown to avoid truncated tool output.
- Provides rich metadata (response time, source count, table presence) for the assistant model.

## Installation

1. Clone or download this repository.
2. Install dependencies and build the plugin:

   ```bash
   bun install
   bun run build
   ```

   > Note: If you encounter TypeScript compilation errors, you may need to fix quote escaping issues in the source code.

   > Playwright is declared as a peer dependency. Install it (and Chromium) in the same project that will host the plugin:
   >
   > ```bash
   > bun install
   > npx playwright install chromium
   > ```
   >
   > Note: Use `npx` instead of `bunx` if bunx is not available.

3. Add the plugin to Opencode. You can either:

   - Drop the built files into your project: copy the entire folder somewhere in your repo and add the relative path in `opencode.json`:

     ```json
     {
       "plugin": [
         "file:///absolute/path/to/google_ai_search/dist/index.js"
       ]
     }
     ```

     > Important: Use absolute paths starting with `file:///` instead of relative paths to avoid module resolution issues.

   - Or publish this package to npm (e.g. `npm publish`) and reference it by name:

     ```json
     {
       "plugin": [
         "opencode-google-ai-search-plugin"
       ]
     }
     ```

4. Restart Opencode. The new tool (`google_ai_search_plus`) will appear in the tool list.

## Usage

Once the plugin is loaded, call the tool from any Opencode session:

```text
google_ai_search_plus "What is the difference between TypeScript and JavaScript?"
```

Parameters:

| Name     | Type    | Description                                                       |
|----------|---------|-------------------------------------------------------------------|
| `query`  | string  | Question or topic to submit to Google AI Mode.                    |
| `timeout`| number  | Optional timeout in seconds (default 30, max 120).                |
| `followUp` | boolean | Treats the query as part of the same conversation (session reuse). |

The tool returns a markdown-formatted answer plus metadata about the response, including source count and whether a comparison table was detected.

## Notes

- Google frequently throttles automated traffic. If you see timeout or “blocking” errors, wait a few minutes or reduce query frequency.
- The plugin stores no state; each call launches (or reuses) an isolated headless Chromium session via Playwright.
- Formatting mirrors the built-in `webfetch` tool so Opencode renders the full AI answer without summarising it.
- You can customise the tool ID by editing `src/index.ts` before publishing.

## Development

- `bun run build` compiles TypeScript to the `dist/` folder (ESM output with type declarations).
- `bun run clean` removes the build artefacts.
- Update the version in `package.json` before publishing to npm.

## License

MIT
