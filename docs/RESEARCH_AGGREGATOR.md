# borg Ecosystem Research Report

## 1. Executive Summary

borg (AI Operating System) is a comprehensive, monorepo-based platform designed to orchestrate LLM-based agents, manage context, and provide a unified interface for various AI tools and frameworks. It is not just an application but an **ecosystem** that aggregates best-in-class open-source agent frameworks, MCP (Model Context Protocol) servers, and CLI tools into a cohesive "OS-like" experience.

The project relies heavily on **external submodules and references** to build its capabilities, effectively acting as a "Motherboard" that plugs in specialized components (the "cards"). This strategy allows borg to leverage existing innovation while focusing on orchestration, memory management, and user experience.

## 2. Core Architecture & Project Structure

The project is structured as a monorepo with `packages/` containing the core system and `external/` containing the integrated ecosystem.

### **Packages (The OS Core)**
*   **`core`**: The Node.js-based backend hub. It manages the lifecycle of agents, memory (vector & graph), skills, and MCP connections. It exposes an API and a WebSocket server for real-time interaction.
*   **`ui`**: A Next.js-based frontend dashboard. It provides a visual interface for monitoring agents, viewing memory, and managing the ecosystem.
*   **`cli`**: A command-line interface to interact with the Core hub.
*   **`browser-extension`**: A bridge to bring browser context into the OS.

### **External Ecosystem (The Plugins)**
The `external/` directory is the heart of the "OS" metaphor, containing submodules that provide specific functionalities:

*   **`agents_repos/`**: A library of agent definitions.
    *   **`open-agents`**: A key integration. It contains high-quality, specialized agents (e.g., `OpenCoder`, `DataAnalyst`) defined in the `OpenCode` standard (YAML+XML). The recent "Agent Adapter" work was specifically meant to onboard this repository.
*   **`auth/`**: Authentication adapters for various providers (Anthropic, Gemini, OpenAI).
*   **`config_repos/`**: Configuration templates and management tools.
*   **`research/`**: Experimental projects and benchmarks (e.g., `OpenCodeEval`).
*   **`tools/`**: Standalone tools and utilities.

## 3. Detailed Submodule & Reference Analysis

Based on `docs/SUBMODULES.md` and `docs/SUBMODULE_MAPPING.md`, the external components are categorized by their role in the OS:

### **A. Core Infrastructure (The Motherboard)**
These components provide the foundational logic for the OS.
*   **`metamcp`**: A Docker-based meta-orchestrator. This appears to be the architectural reference for the borg "Hub".
*   **`CLIProxyAPI`**: A local proxy server powering coding agents. Used by `quotio`.
*   **`claude-mem`**: The primary reference for the memory system, likely implementing graph/vector memory patterns.
*   **`mcp-shark`**: A traffic analyzer for MCP, integrated as a core manager (`McpSharkManager`) for debugging and observability.

### **B. Interfaces (The Face)**
*   **`jules-app`**: A comprehensive React/Next.js dashboard. This is likely the codebase that `packages/ui` is based on or heavily references.
*   **`quotio`**: A native macOS command center.
*   **`mcpenetes`**: "Kubernetes for MCP" - handles client configuration injection (e.g., into VSCode settings).

### **C. Agent Runtimes (The Workers)**
*   **`open-agents` (OpenCode)**: The primary source of "User Space" agents. It defines a standard for portable agent definitions using Markdown.
*   **`smolagents`**: A lightweight agent framework.
*   **`claude-squad`**: Patterns for multi-agent coordination.

### **D. Capabilities (The Peripherals)**
*   **`code-mode` / `opencode`**: Capabilities related to code execution and interpretation.
*   **`voicemode`**: Voice interaction patterns.
*   **`notebooklm-mcp`**: Connector to Google's NotebookLM for knowledge retrieval.

## 4. Key Integration: OpenCode Agents

The recent focus has been on integrating **`open-agents`**.
*   **Format**: These agents are defined in Markdown files with YAML frontmatter (metadata) and XML sections (`<context>`, `<workflow>`, `<critical_rules>`).
*   **Purpose**: They provide highly specialized, context-aware agents (e.g., "OpenAgent", "OpenCoder") that enforce strict project standards and workflows.
*   **Implementation**: A custom `OpenCodeAdapter` in the Core now parses these files, extracting the rich XML rules into the agent's system instructions. This allows borg to "run" these static definitions as dynamic agents.

## 5. Inferred Project Goals

1.  **Unification**: To bring scattered AI tools (MCP servers, specialized agents, CLIs) under one "OS" roof.
2.  **Standardization**: To treat external agent definitions (like OpenCode) as first-class citizens, moving away from hardcoded logic.
3.  **Context Mastery**: To solve the context window problem through intelligent memory management (`claude-mem`) and strict context loading rules (seen in `OpenAgent`).
4.  **Extensibility**: To allow users to plug in any tool or agent repo without rewriting the Core.

## 6. Recommendations / Next Steps

*   **Tool Mapping**: The integrated `open-agents` rely on tools like `read`, `write`, `bash`. We must verify that the Core's `McpProxyManager` correctly maps these requested tools to the actual internal implementations.
*   **Runtime Testing**: We need to "boot" an OpenCode agent (e.g., OpenAgent) and run a real task to verify that the XML-defined rules (like `<approval_gate>`) are respected by the `AgentExecutor`.
