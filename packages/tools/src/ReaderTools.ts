
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
export const ReaderTools = [
    {
        name: "read_page",
        description: "Fetch a webpage and return its content as Markdown. Use this to read documentation, news articles, or search results.",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The valid URL to fetch (must start with http:// or https://)"
                }
            },
            required: ["url"]
        },
        handler: async (args: any) => {
            const url = args.url;
            if (!url || typeof url !== 'string') {
                return {
                    content: [{ type: "text", text: "Error: Invalid URL" }]
                };
            }

            try {
                // Lazy Load Heavy Dependencies
                const { default: TurndownService } = await import('turndown');
                const { JSDOM } = await import('jsdom');

                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    codeBlockStyle: 'fenced'
                });

                // Configure Turndown
                turndownService.remove('script');
                turndownService.remove('style');
                turndownService.remove('noscript');
                turndownService.remove('iframe');

                console.log(`[Borg Reader] Fetching ${url}...`);
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
                }

                const html = await response.text();

                // Parse and clean
                const dom = new JSDOM(html, { url });
                const doc = dom.window.document;

                // Optional: Use Mozilla Readability if we wanted to extract just the main article
                // For now, we'll just dump the body's text content via Turndown for broad context
                const markdown = turndownService.turndown(doc.body || doc.documentElement);

                return {
                    content: [{
                        type: "text",
                        text: `Source: ${url}\n\n${markdown.substring(0, 20000)}` // Limit to prevent context overflow
                    }]
                };

            } catch (e: any) {
                return {
                    content: [{ type: "text", text: `Error reading page: ${e.message}` }]
                };
            }
        }
    }
];
