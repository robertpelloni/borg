# Ultimate MCP Router / Aggregator - Architecture Blueprint

**Purpose**: Combine 100+ MCP servers into one universal MCP with progressive tool disclosure, semantic search, traffic inspection, and session management

**Version**: 1.0  
**Last Updated**: 2026-01-17

---

## Core Architecture

### System Components

#### 1. MCP Registry Service
```
class MCPRegistryService {
  // Discovers, installs, and tracks MCP servers
  // Sources: Punkpeye/AppCypher, wong2, appcypher, ToolSDK, Docker Hub, Playbooks
  
  methods:
  + discoverServers() - Scan all known registries
  + extractServerURLs() - Get all server URLs
  + installServer(name, url) - Install from GitHub/registry to local
  
  state:
    + registryServers: Map<ServerName, ServerDefinition>
    + localServers: Map<ServerName, LocalServerDefinition>
}
```

#### 2. Tool Discovery Service
```
class ToolDiscoveryService {
  // Semantic search for MCP tools using embeddings
  // Sources: Tool registries, local MCP servers, tool definitions
  
  methods:
  + searchTools(query: string, limit: number): Promise<ToolDefinition[]>
  + semanticRank(tools: ToolDefinition[], query: string): Promise<RankedToolDefinition[]>
  
  + toolRegistry: Map<string, ToolDefinition>
  
  + embeddingsModel: Embedding model (OpenAI text-embedding-3-small or Anthropic Claude)

  state:
    + toolRegistry: Map<string, ToolDefinition>  // All known tools
    + embeddingsModel: EmbeddingModel instance
}
```

#### 3. Progressive Disclosure Service
```
class ProgressiveDisclosureService {
  // Manages what tools are visible to the model at any time
  // Key Features:
  //  - MAX_LOADED_TOOLS: Maximum number of tools exposed at once (default: 200)
  //  - Tool Groups: Organize tools by category (finance, memory, browser, etc.)
  //  - Tool Groups: Pinned tools always visible (e.g., system prompts)
  //  - Tool Ranking: Sort tools by relevance score
  //  - Tool Chaining: Compose multiple tools automatically
  //  - Dynamic Loading: Load/unload tools on demand
  //  - Semantic Search: Vector-based tool search
  //  - Context Optimization: Rewrite tool descriptions for LLM context reduction
  
  methods:
  + getVisibleTools(sessionId: string, context?: any): Promise<ToolDefinition[]>
  + loadTool(toolName: string, sessionId?: string): Promise<void>
  + unloadTool(toolName: string): Promise<void>
  + setToolVisibility(toolName: string, visible: boolean): Promise<void>
  + reloadTools(sessionId: string): Promise<void>
  
  + optimizeDescriptions(tools: ToolDefinition[]): Promise<void>
  + reindexTools(tools: ToolDefinition[]): Promise<void>
  
  + clearCache(): Promise<void>
  + getToolGroups(sessionId: string): Promise<Map<string, Set<string>>>
  + addToolGroup(name: string, tools: string[]): Promise<void>
  + removeToolGroup(name: string): Promise<void>

  state:
    + visibleTools: Map<string, ToolDefinition>
    + toolGroups: Map<string, Set<string>>
    + embeddingsCache: Map<string, number[]>
    + toolRanks: Map<string, number[]>
    + toolChains: Map<string, ToolChain[]>
}
}
```

#### 4. Traffic Inspection Service
```
class TrafficInspectionService {
  // Monitors all MCP traffic and logs for debugging
  // Key Features:
  // - Real-time logging of all MCP calls
  // - Call tracing: Track which tools called which others
  // - Latency tracking: Measure response times per tool
  // - Error tracking: Log all errors with context
  // - Traffic summary: Aggregate stats per tool/server
  // - Pattern analysis: Detect common patterns
  // - Rate limiting: Track calls per tool/server
  
  methods:
  + logCall(callId: string, sessionInfo: SessionInfo, toolName, args, result): void
  + startInspection(sessionId: string): void
  + stopInspection(): void
  + getTrafficSummary(sessionId: string): Promise<TrafficSummary>
  + getLatencyStats(sessionId: string): Promise<LatencyStats>
  + getErrorStats(sessionId: string): Promise<ErrorStats>
  
  + clearLogs(sessionId?: string): Promise<void>
  
  + getRecentLogs(sessionId: string, limit?: number): Promise<RecentLog[]>

  state:
    + activeInspections: Map<sessionId, InspectionSession[]>
    + trafficLogs: TrafficLog[]
}
```

#### 5. Session Manager Service
```
class SessionManagerService {
  // Manages MCP session lifecycle: auto-start, auto-restart, keep-alive
  // Key Features:
  // - Single Instance: One server instance, multiple clients
  // - Session lifecycle: Create, Activate, Suspend, Resume, Terminate
  // - Health Checks: Ping, latency, timeout detection
  // - Keep-alive: Heartbeat to prevent timeouts
  // - Latency Tracking: Measure response times
  // - Error Recovery: Auto-restart on fatal errors
  // - Client Registry: Track connected clients
  // - Session Persistence: Save/Load sessions
  
  methods:
  + createSession(sessionId?: string, clientInfo?: ClientInfo): Promise<Session>
  + activateSession(sessionId: string, sessionId: string, clientInfo?: ClientInfo): Promise<void>
  + suspendSession(sessionId: string): Promise<void>
  + resumeSession(sessionId: string, sessionId: string, state?: SessionState): Promise<void>
  + terminateSession(sessionId: string, state?: SessionState, reason?: string): Promise<void>
  + getSession(sessionId: string): Promise<SessionInfo>
  + suspendAll(): Promise<void>
  + resumeAll(): Promise<void>
  + terminateAll(): Promise<void>
  + registerClient(clientId: string, clientInfo: ClientInfo): Promise<void>
  + unregisterClient(clientId: string): Promise<void>
  
  + getActiveSessionCount(): number
  + getConnectedClientCount(): number

  state:
    + sessions: Map<sessionId, Session>
    + clients: Map<sessionId, Map<string, ClientInfo>>
}
```

#### 6. Configuration Service
```
class MCPConfigurationService {
  // Manages MCP configs, secrets, environment variables
  // Key Features:
  // - Auto-detection: Scan .mcp.json files, .borg.json
  // - Auto-configuration: Generate configs for new servers
  // - Multi-format support: Claude vs OpenAI vs Google format
  // - Environment Management: .env expansion, secrets management
  // - Config Writing: Auto-write configs with proper format
  // - Group Management: Tool groups, namespaces
  // - Import/Export: Import/export all configs
  // - Validation: Validate configs before applying
  
  methods:
  + getAllConfigs(): Promise<MCPConfig[]>
  + getConfig(clientId: string): Promise<MCPConfig | null>
  + updateConfig(config: MCPConfig): Promise<void>
  + deleteConfig(clientId: string, configName: string): Promise<void>
  + importConfigs(files: string[]): Promise<void>
  + exportConfigs(): Promise<string>
  + validateConfig(config: MCPConfig): Promise<ValidationResult>
  + detectConfigs(): Promise<MCPConfig[]>
  
  + getAutoDetected(): Promise<MCPConfig[]>
  + clearCache(): Promise<void>

  state:
    + configs: Map<configName, MCPConfig>
    + autoDetected: Map<string, boolean>
    + scanLock: boolean
}
```

#### 7. Server Registry Service
```
class ServerRegistryService {
  // Manages installation and lifecycle of MCP servers
  // Key Features:
  // - Discovery: Scan multiple registries, extract servers
  // - Installation: Clone from GitHub, npm install
  // - Updates: Track upstream changes, pull updates
  // - Health: Check server health status
  // - Dependencies: Install runtime deps (Node.js, Python, etc.)
  // - Metadata: Extract descriptions, categories, tags
  // - Categorization: Assign categories (finance, memory, browser, etc.)
  
  // - Deduplication: Merge duplicate server entries
  // - Rating: Assess relevance to Borg goals

  methods:
  + getAllServers(): Promise<ServerDefinition[]>
  + getServer(name: string): Promise<ServerDefinition | null>
  + installServer(name: string, url: string): Promise<ServerResult>
  + uninstallServer(name: string): Promise<ServerResult>
  + updateServer(name: string, url: string): Promise<ServerResult>
  + getServerUpdates(): Promise<ServerUpdate[]>
  + getHealthStatus(name: string): Promise<HealthStatus>
  + getMetadata(name: string): Promise<ServerMetadata>
  + searchServers(query: string, category?: string): Promise<ServerDefinition[]>
  + syncRegistry(): Promise<void> // Refresh all registries
  
  state:
    + servers: Map<name, ServerDefinition>
    + registrySources: RegistrySource[]
}
```

#### 8. Tool Registry Service
```
class ToolRegistryService {
  // Manages tool definitions and custom tools
  // Key Features:
  // - Internal Tools: Built-in tools (code-executor, file-ops, etc.)
  // - Custom Tools: User-defined scripts, templates
  // - Tool Chaining: Compose multiple tools together
  // - Tool Groups: Organize tools by capability
  // - Tool RAG: Semantic search across tools
  // - Tool Metadata: Version, author, rating
  
  methods:
  + registerTool(definition: ToolDefinition): Promise<void>
  + getTool(name: string): Promise<ToolDefinition | null>
  + getTools(category?: string): Promise<ToolDefinition[]>
  + getAllTools(): Promise<ToolDefinition[]>
  + searchTools(query: string): Promise<ToolDefinition[]>
  + getToolGroups(): Promise<Map<string, Set<string>>>
  + getCustomTools(category?: string): Promise<ToolDefinition[]>
  
  + updateTool(name: string, definition: ToolDefinition): Promise<void>
  + updateToolMetadata(name: string, metadata: any): Promise<void>
  + getToolsByCategory(category: string): Promise<Map<string, ToolDefinition[]>>
  
  + searchToolRegistry: Query external tool registries
  
  state:
    + internalTools: Map<string, ToolDefinition> // Built-in tools
    + customTools: Map<string, ToolDefinition>  // User-defined tools
    + toolGroups: Map<string, Set<string>> // By category
    + toolMetadata: Map<string, ToolMetadata>
}
```

---

## Data Structures

### Tool Definition
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  permissions: string[];
  inputSchema: JSON Schema;
  examples: any[];
  uiHints?: any;
  customMetadata?: Record<string, any>;
  rating: number; // 1-5 relevance to Borg
}
```

### Server Definition
```typescript
interface ServerDefinition {
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  healthStatus: 'running' | 'stopped' | 'error';
  stars: number;
  forks: string[];
  dependencies: Record<string, string>[];
  metadata: any;
  rating: number;
  installed: boolean;
  configFormat: 'claude' | 'openai' | 'google';
}
```

### Session Info
```typescript
interface SessionInfo {
  sessionId: string;
  clientInfo: {
    id: string;
    name: string;
    version: string;
    os: string;
    platform: 'windows' | 'macos' | 'linux';
    location?: string;
  }
  state: 'active' | 'suspended' | 'terminated';
  lastActivity?: Date;
}
```

### Traffic Call Info
```typescript
interface CallInfo {
  callId: string;
  sessionId: string;
  sessionInfo: SessionInfo;
  toolName: string;
  args: any;
  result: any;
  error?: string;
  durationMs?: number;
  timestamp: Date;
}
```

### Traffic Summary
```typescript
interface TrafficSummary {
  sessionId: string;
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  errorCount: number;
  rateLimitExceeded: boolean;
}
```

---

## Integration Points

### With Existing Borg Services

1. **McpManager** (`packages/core/src/managers/McpProxyManager.ts`)
   - Already handles MCP connections, traffic events
   - Add: Discovery service integration
   - Add: Tool disclosure service integration
   - Add: Session management integration

2. **ToolSearchService** (`packages/core/src/services/ToolSearchService.ts`)
   - Already implements semantic search
   - Integrate with progressive disclosure

3. **McpClient** (via MetaMCPClient)
   - Use as fallback for remote MCP servers

### With New Services to Create

1. **McpRegistryService** - Discover and manage all MCP servers
2. **ToolDiscoveryService** - Semantic search with embeddings
3. **ProgressiveDisclosureService** - Dynamic tool loading and disclosure
4. **TrafficInspectionService** - Traffic logging and monitoring
5. **SessionManagerService** - Lifecycle management
6. **ConfigurationService** - Config management
7. **ServerRegistryService** - Server lifecycle management
8. **ToolRegistryService** - Tool definitions and metadata
9. **MetaMCPClient** - Fallback server (optional)

---

## Implementation Phases

### Phase 1: Discovery & Research (Current)
1. **Study existing Borg MCP implementation** in depth
2. **Analyze mcpproxy and meta-mcp-proxy** for patterns
3. **Examine mcp-router** for routing logic
4. **Study Claude Lazy Loading** for progressive disclosure
5. **Document all patterns** from existing tools

### Phase 2: Architecture Design (Next Phase)
1. Design pluggable architecture
2. Define interfaces for all 6 services
3. Create TypeScript interfaces for all modules
4. Design event system for cross-service communication
5. Define state management approach
6. Create state classes

### Phase 3: Core Implementation (Priority: CRITICAL)
1. Implement **MCPRegistryService** - 100+ servers
2. Implement **ToolDiscoveryService** - Semantic search with vector DB
3. Implement **ProgressiveDisclosureService** - Dynamic loading
4. Implement **TrafficInspectionService** - Traffic logging
5. Implement **SessionManagerService** - Lifecycle
6. Implement **ConfigurationService** - Config management
7. Implement **ServerRegistryService** - Lifecycle management
8. Implement **ToolRegistryService** - Tool definitions

### Phase 4: Integration (Priority: HIGH)
1. Integrate with existing services
2. Test all services together
3. Build unified config system
4. Add web UI components

### Phase 5: CLI/TUI/WebUI (Priority: HIGH)
1. Study existing CLI architectures
2. Implement unified CLI with TUI framework
3. Add WebUI components
4. Integrate with all CLI tools
5. Implement session management in CLI
6. Add code execution sandbox
7. Add LSP integration
8. Implement diff visualization
9. Create comprehensive documentation

### Phase 6: Context Management (Priority: HIGH)
1. Study memory systems (Mem0, Letta, SuperMemory)
2. Design pluggable backend interface
3. Implement adapters for multiple stores
4. Build automatic harvesting hooks
5. Implement compaction scheduler
6. Create semantic search
7. Build memory browser UI

### Phase 7: Testing & Validation (Priority: MEDIUM)
1. Unit tests for all services
2. Integration tests
3. Performance benchmarks
4. Load testing
5. Error handling validation
6. Security audits

---

## Key Technical Decisions

### 1. Transport Layer
- Use stdio for all local servers
- Use SSE for browser clients
- Use streaming-HTTP for remote clients

### 2. Storage Backend
- Use Vector DB for tool embeddings and search
- Use JSON for session state (performance)
- Support pluggable backends via adapters

### 3. Architecture Pattern
- **Event-Driven**: Emitter for cross-service communication
- **Stateful**: Map<string, any> for all state
- **Stateless**: Parameters in requests

### 4. Tool Format
- **TOON Format**: Use for context saving/export
- **Custom Formats**: Allow user-defined tool formats

---

## Success Criteria

### Research Phase
- [ ] All 30 research tasks complete
- [ ] All documentation created
- [ ] Architecture blueprints ready
- [ ] Ready for implementation phase

### Implementation Phase
- [ ] All 6 core systems designed
- [ ] Clear implementation roadmap established

---

## Files to Reference

### Existing Borg Code (Analysis Required)
- `packages/core/src/managers/McpProxyManager.ts` - Study this deeply
- `packages/core/src/services/ToolSearchService.ts` - Understand tool search
- `packages/core/src/managers/SessionManager.ts` - Study session lifecycle
- `packages/core/src/managers/McpClient.ts` - Understand client logic
- `packages/core/src/services/ToolDisclosureService.ts` - Understand progressive disclosure
- `packages/core/src/managers/TrafficInspectionService.ts` - Study traffic logging

### External References (Study but Don't necessarily reimplement)
- `mcpproxy` - Study proxy patterns
- `meta-mcp-proxy` - Alternative proxy
- `mcp-router` - Official spec implementation
- `Switchboard` - Tool groups and disclosure
- `Lootbox` - Tool groups and chaining
- `ToolRAG` - Tool RAG capabilities

---

## Next Actions

### Immediate
1. Create detailed architecture document (this file)
2. Update MASTER_INDEX.md with summary
3. Create all category READMEs
4. Update AGENTS.md with patterns
5. Design class structure for each service

### Short-Term
1. Start implementing MCP router (HIGHEST PRIORITY)
2. Create MCPRegistryService
3. Implement ToolDiscoveryService  
4. Implement ProgressiveDisclosureService
5. Implement TrafficInspectionService
6. Implement SessionManagerService
7. Implement ConfigurationService
8. Implement ToolRegistryService
9. Create ServerRegistryService

### Medium-Term
1. Create Memory System interface
2. Implement backend adapters (Chroma, Qdrant first)
3. Build automatic harvesting hooks
4. Implement compaction scheduler
5. Build semantic search

---

**Status**: 🟢 READY FOR IMPLEMENTATION

---

*Last Updated: 2026-01-17*
