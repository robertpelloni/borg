# Research: Code Mode & Sandboxing

**Objective:** Compare `pctx` and `mcp-server-code-execution-mode` to determine the best `run_code` implementation.

## 1. pctx
*   **Approach:** Unified MCP server + HTTP proxy.
*   **Runtime:** Code execution via "Code Mode".
*   **Key Feature:** "Upstream MCP Aggregation". It connects to other servers and exposes them to the script.
*   **Pros:** Very aligned with our "Hub" vision.
*   **Cons:** Python-centric SDK? Need to check support for TS.

## 2. mcp-server-code-execution-mode (Robert Pelloni)
*   **Approach:** "Code Execution Bridge".
*   **Runtime:** Python-focused (Data Science).
*   **Key Feature:** "Rootless Containers". Runs code in Podman/Docker.
*   **Pros:** Secure, persistent filesystem, "Data Science" ready.
*   **Cons:** Heavier than `isolated-vm`.

## 3. Comparison
| Feature | pctx | mcp-server-code-execution-mode | Recommendation |
| :--- | :--- | :--- | :--- |
| **Language** | Python (SDK) | Python (Native) | Support **TypeScript** (Core) + Python (via Docker). |
| **Isolation** | Sandbox | Container (Podman) | Use `isolated-vm` for fast TS, Docker for heavy Python. |
| **Tool Access** | Proxy | Proxy (stdio) | Our Hub already proxies. |

## Recommendation
We should implement a **Hybrid Sandbox**:
1.  **Fast Path (TypeScript):** Use `isolated-vm` (like `cloudflare/code-mode`). Low latency, perfect for logic chaining.
2.  **Heavy Path (Python):** Use Docker containers (like `mcp-server-code-execution-mode`) for data analysis/libraries.
3.  **Unified Interface:** The `run_code` tool should accept `language: "typescript" | "python"` and route accordingly.
