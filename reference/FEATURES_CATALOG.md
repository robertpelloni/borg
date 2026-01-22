# Borg Features & Functionality Catalog

This document tracks the features, functionality, and unique concepts of external AI tools referenced in the project. The goal is to compile a master list to achieve feature parity in Borg.

## Table of Contents
1. [MCP Directories & Hubs](#mcp-directories--hubs)
2. [Skills Libraries](#skills-libraries)
3. [Multi-Agent Orchestration](#multi-agent-orchestration)
4. [CLIs & Harnesses](#clis--harnesses)
5. [MCP Servers](#mcp-servers)
6. [Code Indexing](#code-indexing)
7. [Memory Systems](#memory-systems)
8. [Context Optimization](#context-optimization)
9. [RAG](#rag)
10. [Database](#database)
11. [Computer Use](#computer-use)
12. [Code Sandboxing](#code-sandboxing)
13. [Search](#search)
14. [Routers & Providers](#routers--providers)

---

## MCP Directories & Hubs
*Pending research...*

## Skills Libraries

**Standard Skill Definition (Based on research):**
A "Skill" in this context (Anthropic/MCP standard) is typically a folder containing:
- `SKILL.md`: Metadata (YAML frontmatter) and instructions/prompts.
- `*.js/py`: Scripts or functions that the agent can execute.
### Factory Droid "Skills" (Runbooks)
*Status: Research Complete. Implementation Planned.*

**Overview:**
"Skills" are Factory Droid's version of Runbooks. They are reusable, composable workflows defined in Markdown.

**Implementation Spec:**
- **Structure:** Directory-based (`.factory/skills/<name>/`).
- **Definition:** `SKILL.md` with YAML frontmatter (`name`, `description`) and Markdown instructions.
- **Discovery:** Scans `~/.factory/skills` (Global) and `./.factory/skills` (Workspace).
- **Behavior:** "Model-invoked" (Auto-detected based on task) or "User-invoked" (Slash command).

### Factory Droid "Guardrails" & Execution Mode
*Status: Research Complete. Implementation Planned.*

**Overview:**
A multi-layered safety system protecting local execution.

**Key Features:**
- **Risk Classification:** Commands are classified as Low (read-only), Medium (local edit), or High (network/system mod).
- **Autonomy Levels:** Flags (`--auto low`, `--auto high`) determine which risk levels are auto-executed vs. requiring human approval.
- **Droid Shield:** DLP scanner for secrets in prompts/files.
- **Hooks:** Lifecycle hooks (`pre-prompt`, `pre-exec`, `post-gen`) for enforcing custom policy.

### Anthropic Skills (github.com/anthropics/skills)
*Status: Submodule Added. Researched.*

**Overview:**
The reference implementation for "agent skills".

**Key Features:**
- **Dynamic Loading:** Skills are loaded on-demand.
- **Structure:** Self-contained folders with instruction files.
- **Partners:** Includes skills for Notion, etc.

## Multi-Agent Orchestration

### OpenHands (github.com/OpenHands/OpenHands)
*Status: Submodule Added. Researched.*

**Overview:**
A platform for software development agents involving an interaction loop between an agent and an environment (Docker sandbox).

**Key Features:**
- **AgentController:** Manages the agent loop, state, and errors.
- **Microagents:** Specialized sub-agents (e.g., specific to a repo or task) with unique prompts/tools.
- **Autopilot:** "StuckDetector" and "StateTracker" for recovering from loops and crashes.
- **Sandboxing:** Docker-based environment for safe execution.
- **Enterprise Features:** Billing/subscription management integration.

### Maestro (github.com/pedramamini/Maestro)
*Status: Submodule Added. Researched.*

**Overview:**
An "Agent Orchestration Command Center" that directs multiple CLI-based agents.

**Key Features:**
- **Supervisor:** Directs external CLIs (Claude Code, OpenCode, etc.).
- **Auto Run:** Automated task execution with session tracking.
- **Routing:** Tracks token usage/costs across providers (Anthropic, OpenRouter).
- **UI:** Unified dashboard for managing multiple agent sessions.

### MetaMCP (github.com/robertpelloni/metamcp)
*Status: Submodule Added. Researched.*

**Overview:**
MetaMCP is an MCP proxy and aggregator that acts as a middleware gateway for multiple MCP servers. It standardizes connection management, authentication, and tool routing.

**Key Features:**
- **Aggregator:** Combines multiple MCP servers into a single endpoint.
- **Progressive Tool Disclosure:** Exposes only meta-tools (`search_tools`, `load_tool`) initially to save context.
- **Semantic Tool Search:** Uses `pgvector` and embeddings to find relevant tools dynamically ("Tool RAG").
- **Code Mode:** Secure sandbox (`isolated-vm`) to execute JS/TS code that can chain MCP tool calls.
- **Traffic Inspection:** Logs all tool calls ("Mcpshark" integration).
- **Middleware:** Architecture supports pluggable middleware (logging, auth, policy).
- **Autonomous Agents:** `run_agent` tool uses LLMs to generate and execute code using available tools.
- **Authentication:** Supports API Keys, OAuth 2.0.

**Architecture:**
- Backend: Node.js (Express/TRPC).
- Database: PostgreSQL (with pgvector).
- Sandbox: `isolated-vm`.
- Frontend: Next.js.

## CLIs & Harnesses

### Claude Code (github.com/MadAppGang/claude-code)
*Status: Submodule (madappgang fork) Added. Researched.*

**Overview:**
A set of production-grade plugins ("MAG Claude Plugins") for Anthropic's Claude Code CLI, focusing on enterprise workflows, frontend/backend development, and orchestration.

**Key Features:**
- **Frontend Development Plugin:** 13 specialized agents, 8-phase implementation workflow, CSS-aware validation.
- **Code Analysis Plugin:** "Codebase Detective" agent with semantic search (40% token reduction).
- **Backend Plugin:** tailored for Bun, Hono, Prisma.
- **Orchestration Plugin:**
    - **4-Message Pattern:** Parallel execution for speedup.
    - **Consensus Analysis:** Cross-model agreement prioritization.
    - **Quality Gates:** User approval and iteration loops.
- **Claudish CLI:** A standalone CLI to run Claude Code with *any* OpenRouter model (Grok, GPT-5, Qwen, etc.), bypassing Anthropic API limits.

### CodeBuff (github.com/CodebuffAI/codebuff)
*Status: Submodule Added. Pending Deep Research.*

### CodeBuff (github.com/CodebuffAI/codebuff)
*Status: Submodule Added. Pending Deep Research.*

## MCP Servers

### Official Servers (github.com/modelcontextprotocol/servers)
*Status: Submodule Added. Researched.*

**Overview:**
Reference implementations for core MCP functionality.

**Key Servers:**
- **Filesystem:** `read/write/edit_file`, `list_directory`. Node.js.
- **GitHub:** `create_issue`, `get_file_contents`, `pr_read`. Go.
- **Google Drive:** `search`, export Docs/Sheets. Node.js.

### AWS MCP (github.com/awslabs/mcp)
*Status: Pending Submodule Addition. Researched.*

**Overview:**
A monorepo covering automation for 50+ AWS services.

**Key Features:**
- **Bedrock:** `invoke_model` for AI.
- **S3:** `s3://` resource provider.
- **Lambda/EC2:** Compute management.

### Firebase Genkit (github.com/firebase/genkit)
*Status: Submodule Added. Researched.*

**Overview:**
A framework acting as both an MCP Host and Client.

**Key Features:**
- **Bridge:** Exposes Genkit flows as MCP tools.
- **Client:** Consumes external MCP tools for Genkit agents.

## Code Indexing & Context

### Cursor context (cursor.com/docs/context)
*Status: Researched. Reference Implementation.*

**Overview:**
A fork of VS Code with deep AI integration.

**Key Features:**
- **Shadow Workspace:** Runs a background headless VS Code instance to resolve symbols/jumps accurately.
- **Hybrid Indexing:** Combines AST-based chunking with vector embeddings.
- **Cpp Implementation:** High-performance indexing backend.

### Continue (github.com/continuedev/continue)
*Status: Pending Submodule Addition. Researched.*

**Overview:**
Open-source autopilot for VS Code/JetBrains.

**Key Features:**
- **Codebase RAG:** Uses `tree-sitter` for AST chunking and LanceDB for local vector storage.
- **Index Management:** Background process handling indexing updates.

### Stack Auth (github.com/stack-auth/stack)
*Status: Pending Submodule Addition. Researched.*

**Overview:**
User/Tenant indexing and identity management.

**Key Features:**
- **Identity Indexing:** Database-backed search for users/orgs.
- **Auth:** Critical for multi-provider/multi-tenant Borg architecture.

## Memory Systems

### Letta (formerly MemGPT) (github.com/letta-ai/letta)
*Status: Submodule Added. Researched.*

**Overview:**
A stateful LLM memory system that treats context like an operating system's RAM.

**Key Features:**
- **Hierarchical Memory:** "Core Memory" (in-context RAM) vs. "Archival Memory" (Database).
- **OS-like Paging:** Agents can autonomously "page" information in and out of context via tools.
- **Persistence:** Long-running agents that persist state indefinitely.

### Zep (github.com/getzep/zep)
*Status: Submodule Added. Researched.*

**Overview:**
A long-term memory service for AI assistants using temporal knowledge graphs.

**Key Features:**
- **Temporal Knowledge Graph:** Stores entities and facts with timestamps.
- **Fact Invalidation:** Automatically invalidates obsolete facts (e.g., user changed preference).
- **Context Blocks:** Assembles optimized context strings for injection.

### Beads (github.com/steveyegge/beads)
*Status: Submodule Added. Researched.*

**Overview:**
A "Git as Database" memory system designed specifically for coding agents.

**Key Features:**
- **Git-backed:** Memories are stored as JSONL blobs in `.beads/` and versioned with code.
- **Dependency Graph:** Tracks task dependencies and state across long horizons.
- **Compaction:** Summarizes old tasks ("beads") to save context.

### Mem0 (github.com/mem0ai/mem0)
*Status: Submodule Added. Researched.*

**Overview:**
A universal memory layer focusing on user personalization.

**Key Features:**
- **Multi-Level Memory:** User, Session, and Agent-level memory scoping.
- **Adaptive Personalization:** Learns user preferences across sessions.
- **Vector + Graph:** Hybrid storage for semantic and relational retrieval.

## Context Optimization
*Pending research...*

## RAG
*Pending research...*

## Database
*Pending research...*

## Computer Use
*Pending research...*

## Code Sandboxing
*Pending research...*

## Search

### Exa (github.com/exa-labs/exa-mcp-server)
*Status: Researched.*

**Overview:**
Neural web search engine accessible via MCP.

**Key Features:**
- **Neural Index:** Indexes the web by meaning/intent, not just keywords.
- **Context Source:** Powerful "Router" tool to find external technical documentation.

## Routers & Providers

### AgentRouter (agentrouter.org)
*Status: Pending Submodule Addition. Researched.*

**Overview:**
A comprehensive proxy for managing LLM connections, credits, and routing.

**Key Features:**
- **Unified API:** One endpoint for 75+ models.
- **BYOK (Bring Your Own Key):** Supports existing provider keys.
- **Credit Management:** Internal credit system, potentially consolidating billing.
- **Stability:** Handles model fallbacks to generic models if a specific one fails (stabilizing "autopilot" runs).

---

## 🏗️ Borg Design Notes (User Vision)

### The "Director + Swarm" Architecture
- **Objective:** Establish a "Frontier Model" (e.g., Claude 3.5 Sonnet, GPT-4o) as a **Director/Supervisor**.
- **The Team:** A swarm of sub-agents running **Free/Cheaper Models** (specifically GLM 4.7, Flash models).
- **Routing Logic:** Intelligent selection of sub-agents/models based on:
    - **Credits/Quota:** Switch providers (OpenRouter, Cursor, Roo Code, etc.) when free tiers are exhausted.
    - **Capability:** Dispatch simple implementation tasks to GLM 4.7; keep complex reasoning for the Director.
- **Mechanism:**
    - The Director "oversees a bunch of CLI sessions".
    - Auto-recovery/restart of crashed sessions.
    - Application of "Autopilot" logic to each sub-session.
