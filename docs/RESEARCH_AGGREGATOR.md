# Research: Aggregator & Router Features

**Objective:** Compare `metamcp` (Base) with `magg`, `mcphub`, `mcpproxy-go`, and `Super-MCP` to identify superior features to integrate.

## 1. MetaMCP (Current Base)
*   **Routing:** Basic namespace-based routing.
*   **Discovery:** Dynamic via `list_tools`.
*   **UI:** React-based inspector.
*   **Missing:** Advanced security sandboxing, robust "Package Manager" feel.

## 2. Magg
*   **Key Feature:** "Package Manager for LLM Tools".
*   **Insight:** Magg emphasizes *installation* and *management* (like `npm install`).
*   **Recommendation:** Adopt `magg`'s pattern for the "Registry" feature. Allow users to `install` tools via the Hub's CLI/UI, which downloads them to `mcp-servers/`.

## 3. McpHub
*   **Key Feature:** "Smart Routing" & "Multi-Workspace".
*   **Insight:** Uses embeddings (vector search) to route requests to the right tool.
*   **Recommendation:** This aligns with our "Semantic Tool Search" plan. We should ensure our `pgvector` implementation matches `mcphub`'s semantic routing capabilities.

## 4. Super-MCP
*   **Key Feature:** "Docker Sandboxing".
*   **Insight:** Runs every MCP server in a container.
*   **Recommendation:** Our "Code Mode" uses `isolated-vm` or Docker. We should consider using Docker for *all* untrusted MCP servers (like `Super-MCP` does) for security.

## 5. Switchboard
*   **Key Feature:** "Decision Tree Navigation" & "Lazy Loading".
*   **Insight:** Presents a hierarchy of tools (`database` -> `postgres` -> `query`).
*   **Recommendation:** Adopt this for "Progressive Disclosure". Instead of flattening all tools, expose Categories first.

## Conclusion
*   **Routing:** Combine `metamcp` (base) + `mcphub` (semantic) + `Switchboard` (hierarchical).
*   **Management:** Adopt `magg`'s installation logic.
*   **Security:** Adopt `Super-MCP`'s containerization for untrusted servers.
