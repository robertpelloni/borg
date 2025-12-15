# Super AI Plugin

**A Meta-Orchestrator and Open Source AI OS Layer.**

This project is a monorepo containing the skeleton for a powerful plugin system that wraps your development environment (VSCode, Chrome, CLIs) to provide unified context, hooks, and agent orchestration.

## Documentation

Please refer to [DESIGN.md](./DESIGN.md) for a detailed breakdown of the architecture, vision, and component design.

## Structure

- **packages/core**: The Node.js Core Service (Fastify + Socket.io).
- **packages/ui**: The React Dashboard (MetaMCP integration).
- **packages/types**: Shared TypeScript definitions.
- **agents/**: Agent definitions.
- **skills/**: Skill definitions.
- **hooks/**: Hook configurations.
- **mcp-servers/**: Managed MCP servers.

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build the packages:
   ```bash
   pnpm build
   ```

3. Start the Core Service:
   ```bash
   cd packages/core
   node dist/index.js
   ```

4. Start the UI (Development):
   ```bash
   cd packages/ui
   pnpm dev
   ```
