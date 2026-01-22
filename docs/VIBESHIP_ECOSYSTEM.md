# Vibeship Ecosystem

> Complete documentation of the 6 Vibeship repositories integrated into Borg.

## Overview

Vibeship is a production-grade AI development ecosystem created by [vibeforge1111](https://github.com/vibeforge1111). It provides:

- **462 specialist skills** with anti-patterns and validation
- **Security scanning** with 16 integrated tools and 2000+ rulesets
- **Semantic memory** for AI CLI tools
- **Multi-agent orchestration** with guardrails

---

## Repository Summary

| Repo | Stars | Purpose | Borg Location |
|------|:-----:|---------|---------------|
| **vibeship-spawner-skills** | 520 | 462 production-grade skills (4-file system) | `external/skills_repos/vibeship/` |
| **vibeship-spawner** | 14 | Orchestration with specialist skills | `agents/orchestration/` |
| **vibeship-scanner** | 10 | Security scanner with MCP integration | `tools/security/` |
| **vibeship-idearater** | 2 | Startup idea PMF rater | `tools/misc/` |
| **vibeship-plugin** | 1 | Claude Code plugin | `external/plugins/vibeship/` |
| **vibememo** | 1 | Semantic memory for AI CLIs | `mcp-servers/memory/` |

---

## 1. Vibeship Spawner Skills (520 stars)

**Location**: `external/skills_repos/vibeship/`  
**URL**: https://github.com/vibeforge1111/vibeship-spawner-skills

### The 4-File Skill System

Each of the 462 skills uses a consistent 4-file structure:

```
skills/
└── frontend-engineer/
    ├── skill.yaml           # Identity, patterns, anti-patterns, handoffs
    ├── sharp-edges.yaml     # Gotchas with detection patterns
    ├── validations.yaml     # Automated code quality checks
    └── collaboration.yaml   # Skill delegation rules
```

### File Descriptions

#### skill.yaml
```yaml
name: frontend-engineer
description: Expert in React, TypeScript, and modern web development
patterns:
  - Use functional components with hooks
  - Implement proper error boundaries
  - Follow accessibility guidelines (WCAG 2.1)
anti_patterns:
  - Using class components for new code
  - Inline styles without design system tokens
  - Missing loading/error states
handoffs:
  - backend-engineer: API contract changes
  - devops-engineer: Build configuration
  - security-engineer: Auth flows
```

#### sharp-edges.yaml
```yaml
gotchas:
  - name: React 18 Strict Mode Double Render
    detection: "useEffect.*console.log"
    explanation: Effects run twice in dev mode
    fix: Use refs for side effects that shouldn't duplicate
    
  - name: Stale Closure in useEffect
    detection: "useEffect.*setState.*\\[\\]"
    explanation: Empty deps array captures stale state
    fix: Add state to deps or use functional updates
```

#### validations.yaml
```yaml
checks:
  - name: No any types
    pattern: ": any"
    severity: error
    
  - name: Components have error boundaries
    pattern: "ErrorBoundary"
    required_in: "App.tsx"
    severity: warning
```

#### collaboration.yaml
```yaml
delegates_to:
  - skill: backend-engineer
    when: "API changes needed"
  - skill: security-engineer
    when: "Auth or sensitive data handling"
    
receives_from:
  - skill: product-manager
    for: "Feature specifications"
  - skill: designer
    for: "UI/UX mockups"
```

### Skill Categories

| Category | Count | Examples |
|----------|:-----:|----------|
| Frontend | 45 | react-engineer, vue-engineer, css-architect |
| Backend | 52 | nodejs-engineer, python-engineer, go-engineer |
| DevOps | 38 | kubernetes-engineer, terraform-engineer, ci-cd-engineer |
| Security | 25 | security-engineer, penetration-tester, compliance-auditor |
| Data | 42 | data-engineer, ml-engineer, analytics-engineer |
| Mobile | 28 | ios-engineer, android-engineer, flutter-engineer |
| Architecture | 35 | system-architect, api-designer, database-architect |
| Management | 30 | product-manager, scrum-master, technical-writer |
| Testing | 40 | qa-engineer, test-automation, performance-tester |
| Other | 127 | Various specialized skills |

---

## 2. Vibeship Spawner (14 stars)

**Location**: `agents/orchestration/`  
**URL**: https://github.com/vibeforge1111/vibeship-spawner

### Features

- **462 specialist skills** loaded from vibeship-spawner-skills
- **Project memory** persists context across sessions
- **Guardrails** prevent dangerous operations
- **2000+ sharp edges** (gotchas from real production failures)

### MCP Integration

```json
{
  "mcpServers": {
    "vibeship-spawner": {
      "url": "https://mcp.vibeship.co"
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `spawn_skill` | Activate a specialist skill |
| `list_skills` | Browse available skills |
| `get_sharp_edges` | Get gotchas for current context |
| `validate_code` | Run skill validations |
| `delegate_task` | Hand off to another skill |

### Usage Example

```typescript
// Spawn frontend engineer for React work
await mcp.call("spawn_skill", {
  skill: "frontend-engineer",
  context: "Building a dashboard with charts"
});

// Get relevant gotchas
const edges = await mcp.call("get_sharp_edges", {
  technologies: ["react", "d3", "typescript"]
});
```

---

## 3. Vibeship Scanner (10 stars)

**Location**: `tools/security/`  
**URL**: https://github.com/vibeforge1111/vibeship-scanner

### 16 Integrated Scanners

| Scanner | Type | Purpose |
|---------|------|---------|
| **Opengrep** | SAST | Static analysis (Semgrep rules) |
| **Trivy** | Container | Vulnerability scanning |
| **Gitleaks** | Secrets | API key/credential detection |
| **npm audit** | Dependencies | Node.js vulnerability check |
| **pip-audit** | Dependencies | Python vulnerability check |
| **cargo-audit** | Dependencies | Rust vulnerability check |
| **bundler-audit** | Dependencies | Ruby vulnerability check |
| **Safety** | Dependencies | Python safety check |
| **Snyk** | Multi | Commercial scanner integration |
| **OWASP ZAP** | DAST | Dynamic analysis |
| **Nuclei** | DAST | Template-based scanning |
| **Checkov** | IaC | Infrastructure as code |
| **TFLint** | IaC | Terraform linting |
| **Hadolint** | Container | Dockerfile linting |
| **Kube-linter** | K8s | Kubernetes manifest linting |
| **Custom** | Various | User-defined rules |

### MCP Integration

```bash
# Add to Claude Code / Cursor
npx mcp-remote https://scanner.vibeship.co/mcp
```

### Unique Feature: AI Fix Prompts

When vulnerabilities are found, Vibeship Scanner generates AI-optimized prompts to fix them:

```json
{
  "vulnerability": "SQL Injection in user query",
  "severity": "critical",
  "location": "src/db/users.ts:45",
  "ai_fix_prompt": "Refactor the SQL query at line 45 to use parameterized queries. The current string concatenation allows SQL injection. Use the database driver's prepared statement API instead of string interpolation."
}
```

### 2000+ Security Rulesets

Categories include:
- OWASP Top 10
- CWE Top 25
- SANS Top 25
- PCI DSS compliance
- HIPAA compliance
- SOC 2 requirements

---

## 4. Vibeship Plugin (1 star)

**Location**: `external/plugins/vibeship/`  
**URL**: https://github.com/vibeforge1111/vibeship-plugin

### Claude Code Plugin

Integrates the entire Vibeship ecosystem into Claude Code:

### Slash Commands

| Command | Description |
|---------|-------------|
| `/vibeship-init` | Initialize Vibeship in project |
| `/vibeship-start` | Start a new session with memory |
| `/vibeship-save` | Save current session to memory |
| `/vibeship-status` | Show active skills and memory |
| `/vibeship-scan` | Run security scan |

### Integrations

```
┌─────────────────────────────────────────────────────────────┐
│                     Vibeship Plugin                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Memory    │  │   Skills    │  │  Security   │         │
│  │  (Mind MCP) │  │ (462 specs) │  │  (Scanner)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                          ▼                                  │
│                   Claude Code CLI                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Configuration

```yaml
# .vibeship/config.yaml
memory:
  provider: mind-mcp
  endpoint: https://memory.vibeship.co
  
skills:
  enabled: true
  custom_skills_dir: .vibeship/skills/
  
security:
  auto_scan: true
  scan_on_commit: true
  severity_threshold: medium
```

---

## 5. Vibememo (1 star)

**Location**: `mcp-servers/memory/`  
**URL**: https://github.com/vibeforge1111/vibememo

### Semantic Memory for AI CLIs

Fork of [RLabs-Inc/memory](https://github.com/RLabs-Inc/memory) with enhancements.

### Tech Stack

- **Python 3.12+**
- **FastAPI** - REST API
- **ChromaDB** - Vector storage
- **SQLite** - Metadata storage
- **sentence-transformers** - Embeddings

### Features

| Feature | Description |
|---------|-------------|
| **AI-Curated Memories** | LLM decides what's worth remembering |
| **Two-Stage Retrieval** | Vector search + recency weighting |
| **Session Primers** | Pre-load context for new sessions |
| **Claude Code Hooks** | Auto-save on session end |

### API Endpoints

```
POST /memory/process    # Process and store memories
GET  /memory/context    # Get relevant context for query
POST /memory/checkpoint # Save session checkpoint
GET  /memory/primers    # Get session primer memories
```

### Integration Example

```python
import httpx

# Store a memory
await client.post("/memory/process", json={
    "content": "User prefers functional React components",
    "session_id": "abc123",
    "importance": "high"
})

# Retrieve context
context = await client.get("/memory/context", params={
    "query": "How should I write this React component?",
    "limit": 5
})
```

---

## 6. Vibeship Idearater (2 stars)

**Location**: `tools/misc/`  
**URL**: https://github.com/vibeforge1111/vibeship-idearater

### Startup Idea PMF Rater

Evaluates startup ideas across 8 dimensions using Claude Haiku.

### Tech Stack

- **SvelteKit** - Frontend framework
- **Claude Haiku** - AI evaluation
- **Tailwind CSS** - Styling

### Evaluation Dimensions

| Dimension | Weight | Description |
|-----------|:------:|-------------|
| Problem | 15% | Is this a real, painful problem? |
| Market | 15% | Is the market large enough? |
| Solution | 15% | Does the solution actually solve it? |
| Timing | 10% | Is now the right time? |
| Uniqueness | 15% | What's the unfair advantage? |
| Business Model | 10% | Can it make money? |
| Scalability | 10% | Can it grow efficiently? |
| Defensibility | 10% | Can it maintain competitive edge? |

### Output Format

```json
{
  "idea": "AI-powered code review tool",
  "overall_score": 7.8,
  "dimensions": {
    "problem": { "score": 9, "feedback": "..." },
    "market": { "score": 8, "feedback": "..." },
    "solution": { "score": 7, "feedback": "..." },
    "timing": { "score": 9, "feedback": "..." },
    "uniqueness": { "score": 6, "feedback": "..." },
    "business_model": { "score": 8, "feedback": "..." },
    "scalability": { "score": 8, "feedback": "..." },
    "defensibility": { "score": 6, "feedback": "..." }
  },
  "recommendation": "Strong idea with execution risk..."
}
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Borg Meta-Orchestrator                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Vibeship Ecosystem                           │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │   │
│  │  │   Spawner   │───►│   Skills    │    │   Scanner   │          │   │
│  │  │ (orchestr.) │    │ (462 specs) │    │ (security)  │          │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘          │   │
│  │         │                                     │                  │   │
│  │         │           ┌─────────────┐           │                  │   │
│  │         └──────────►│   Plugin    │◄──────────┘                  │   │
│  │                     │(Claude Code)│                              │   │
│  │                     └──────┬──────┘                              │   │
│  │                            │                                     │   │
│  │                     ┌──────▼──────┐                              │   │
│  │                     │  Vibememo   │                              │   │
│  │                     │  (memory)   │                              │   │
│  │                     └─────────────┘                              │   │
│  │                                                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  MCP Endpoints:                                                          │
│  • https://mcp.vibeship.co (Spawner)                                    │
│  • https://scanner.vibeship.co/mcp (Scanner)                            │
│  • https://memory.vibeship.co (Vibememo)                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Add MCP Servers to Claude Code

```json
// .claude/mcp.json
{
  "mcpServers": {
    "vibeship-spawner": {
      "url": "https://mcp.vibeship.co"
    },
    "vibeship-scanner": {
      "command": "npx",
      "args": ["mcp-remote", "https://scanner.vibeship.co/mcp"]
    }
  }
}
```

### 2. Initialize Vibeship Plugin

```bash
# In Claude Code
/vibeship-init
```

### 3. Start Using Skills

```bash
# Spawn a specialist
/vibeship-start frontend-engineer

# Check for gotchas
/vibeship-status

# Run security scan
/vibeship-scan
```

---

## Related Documentation

- [FEATURE-MATRIX.md](superai-cli/FEATURE-MATRIX.md) - Feature comparison with vibeship tools
- [SUBMODULES.md](../SUBMODULES.md) - Complete submodule listing including vibeship repos
- [MCP Ecosystem](superai-cli/MCP_ECOSYSTEM.md) - MCP server organization

---

## License

All Vibeship repositories are MIT licensed.

## Credits

Created by [vibeforge1111](https://github.com/vibeforge1111)
