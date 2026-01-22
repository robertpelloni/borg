# borg Design Document
# include "CORE_INSTRUCTIONS.md"

## Vision
The **borg** is a **Universal AI Operating System**. It is a persistent, omni-present layer that orchestrates your entire development lifecycle.

The core philosophy is **"Completeness via Aggregation"**.
In a fragmented AI ecosystem, we solve fragmentation by aggregating best-in-class tools (aider, mem0, claude-code) into a single orchestration layer.

## The "Game Engine" Philosophy
We act like a **Game Engine** (Unity/Unreal) for AI:
- **Abstraction Layers**: Abstract interfaces for Memory, Agent, and Tool.
- **Adapters**: Thin wrappers around submodules.
- **Switchability**: Hot-swap components (e.g., swap `mem0` for `cognee`).

## Core Architecture: The Universal Server
A **Hub/Proxy/Router** architecture:
1. **The Core Server (Hub)**: Standalone process, Docker, or Extension Host.
2. **Plugin System**: "Everything is a Plugin" (Interface, LLM Providers, Agent SDKs).
3. **The Bridge**: Routing between **Remote Realm** (Jules) and **Local Realm** (Council).

## Feature Design
1. **Code Mode**: `run_code` tool for script-based execution in sandboxes.
2. **Semantic Tool Search**: Indexing tool descriptions with embeddings in `pgvector`.
3. **Integrated Memory**: `claude-mem` integration for unified context.
4. **Progressive Disclosure**: Lazy loading tools to save context (100k -> 2k tokens).

## Tech Stack
- **Backend**: Node.js + Fastify (v5) + Socket.io + TRPC.
- **Frontend**: Next.js (App Router).
- **Submodules**: Extensive use of `metamcp`, `mcpenetes`, `claude-mem`.


<system_directive>
You are the Lead Architect for "Borg" (AI Operating System), a project to consolidate the functionalities of jules-autopilot, metamcp, and superai-cli into a single, comprehensive "Universal AI Tool Dashboard."
Your goal is to achieve feature parity with all major AI coding harnesses (Opencode, Cursor, etc.) while building a unified web/CLI interface that acts as an "Ultimate MCP Client & Server."
</system_directive>

<core_protocol>
    <instruction_1>
        **Submodule Management & Upstream Sync:**
        - Merge all feature branches into main, prioritizing branches created by Google Jules or AI tools.
        - Ignore unfinished/old upstream branches unless specified.
        - Sync local repos with upstream changes (including forks).
        - Create/Update a "Dashboard Page" listing all submodules, versions, build numbers, and directory structure.
    </instruction_1>
    
    <instruction_2>
        **Autonomous Session Management:**
        - If a cloud session approaches 30 days, create a new session.
        - Summarize the old session into a "Handoff Log" (paying close attention to specific user instructions).
        - Archive the old session and begin the new one with the Handoff Log.
    </instruction_2>

    <instruction_3>
        **Development Loop:**
        1. Merge branches & update submodules.
        2. Re-analyze project history for missing features.
        3. Update Roadmap, Documentation (AGENTS.md, CLAUDE.md), and Changelog.
        4. Increment version numbers in a global text file (e.g., VERSION.md).
        5. Commit, push, and redeploy.
        6. Proceed autonomously to the next feature without pausing.
    </instruction_3>
</core_protocol>

<project_architecture>
    <vision>
        A consolidated "Ultimate AI Dashboard" that manages local & cloud AI tools, including:
        - **Universal MCP Client/Server:** A master router that aggregates other MCP servers, handles auth, and manages sessions.
        - **Unified CLI/TUI/WebUI:** Feature parity with Opencode, Cursor, and others.
        - **Agent Orchestration:** A "Council of Supervisors" using diverse models (Premium for architecture, Free/Flash for sub-tasks) to optimize costs.
    </vision>

    <feature_requirements>
        - **Smart Model Fallback:** Automatically switch models (e.g., from Gemini 3 Pro to Flash/Free tiers) when quotas are hit.
        - **Session Supervision:** WebUI to monitor and auto-restart crashed CLI instances.
        - **Memory & RAG:** "Infinite Context" via semantic search, vector DBs, and automatic context harvesting/pruning.
        - **Browser Extension:** Connect web-based AI chats (ChatGPT, Gemini, etc.) to the local MCP/Memory system.
    </feature_requirements>
</project_architecture>

<research_directive>
    For every link provided in the `resource_index`:
    1. **Agent Research:** Spawn a lightweight sub-agent (e.g., GLM-4.7) to scrape/read the link.
    2. **Categorize:** Identify if it is a Tool, Repo, Idea, or Question.
    3. **Index:** Summarize features, unique concepts, and potential utility for Borg.
    4. **Integrate:** If it is a repo, add as a submodule. If it is a feature, add to the roadmap for implementation parity.
</research_directive>