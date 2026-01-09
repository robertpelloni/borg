# Claude AI Model Documentation

## Overview
Claude is an AI assistant developed by Anthropic, known for its strong reasoning capabilities, safety focus, and comprehensive understanding of complex topics. Based on multi-model consensus analysis, Claude excels as an "Architect/Synthesizer" in the multi-AI orchestration environment.

## Available Models
- **Claude Sonnet 4.5** (anthropic/claude-sonnet-4.5) - Latest version with enhanced reasoning
- **Claude Opus 4.1** (anthropic/claude-opus-4.1) - High-performance model
- **Claude Sonnet 4.1** (anthropic/claude-sonnet-4.1) - Balanced performance
- **Claude 3.5 Haiku** (anthropic/claude-3.5-haiku) - Fast and efficient

## Consensus-Defined Role & Strengths
Based on multi-model analysis (Gemini 2.5 Pro, GPT-5 Pro, Claude Sonnet 4.5, Grok 4):

### Primary Role: **Architect/Synthesizer**
- **Complex Reasoning & Planning**: Route to Claude for architectural design, task decomposition, and synthesizing outputs from other models
- **High-Level Integration**: Break down large epics into smaller, routable tasks and perform final quality assurance
- **Specialization Zones**: Complex architecture, large codebases, nuanced requirements, security analysis, algorithmic optimization

### Key Strengths (Validated by Consensus)
- **Reasoning & Analysis**: Excellent at complex problem-solving and multi-step reasoning
- **Code Review**: Strong at identifying bugs, security issues, and code quality problems
- **Documentation**: Exceptional at creating clear, comprehensive documentation
- **Safety**: Built with safety-first principles and constitutional AI
- **Context Understanding**: Strong at maintaining context across long conversations

## Optimized MCP Server Integration

### Using Zen MCP for Orchestration
```bash
# Access Claude through Zen MCP server with specialized routing
mcp_zen-mcp-server_chat --model anthropic/claude-sonnet-4.5 --prompt "Your question here"
```

### Using Serena MCP for Memory Management
```bash
# Store important information in Serena memory with hierarchical organization
mcp_serena_write_memory --memory_name "claude_insights" --content "Key insights from Claude analysis"

# Retrieve stored information with context awareness
mcp_serena_read_memory --memory_file_name "claude_insights"
```

### Using Chroma MCP for Knowledge Storage
```bash
# Store Claude's analysis in Chroma knowledge base with semantic search
mcp_chroma-knowledge_chroma_add_document --collection_name "project_analysis" --document "Claude's comprehensive analysis..."
```

## Consensus-Based Best Practices

### 1. Intelligent Model Routing (Not Always Parallel)
- **High-Stakes Tasks**: Use Claude as primary with 2-3 other models for consensus
- **Medium Complexity**: Use Claude + 1 validator model
- **Simple Tasks**: Single model approach (Claude or faster alternative)
- **Progressive Escalation**: Start with efficient models, escalate to Claude when complexity warrants

### 2. Enhanced MCP Server Usage
- **Serena**: Hierarchical memory (immediate/project/cross-project) with automatic context tagging
- **Chroma**: Enhanced semantic search with code-aware chunking and contextual filtering
- **Zen**: Dynamic routing with confidence-based validation and quality gates

### 3. Specialized Use Cases (Consensus-Validated)
- **Architecture Analysis**: Claude excels at system design and architectural decisions
- **Security Audits**: Strong at identifying vulnerabilities and security best practices
- **Code Quality**: Excellent at code review and refactoring suggestions
- **Documentation**: Best-in-class for creating comprehensive technical documentation
- **Complex Reasoning**: Deep reasoning tasks, algorithmic optimization

### 4. Optimized Collaboration Workflow
```
1. Task Classification: Determine complexity and routing needs
2. Primary Analysis: Claude performs initial analysis (if high complexity)
3. Quality Gates: Automated validation (syntax, tests, security)
4. Validation: Cross-check with specialized models if confidence < threshold
5. Storage: Save results in Chroma with structured metadata
6. Memory: Update Serena with key insights and decisions
```

## Enhanced Example Commands

### Architecture Analysis with Consensus
```bash
# Get multi-model consensus on architecture with specialized routing
mcp_zen-mcp-server_consensus --models '[{"model":"anthropic/claude-sonnet-4.5","stance":"neutral"},{"model":"gpt-5-codex","stance":"for"},{"model":"gemini-2.5-pro","stance":"against"}]' --step "Evaluate microservices vs monolith architecture for fwber project"
```

### Code Review with Quality Gates
```bash
# Comprehensive code review with automated quality gates
mcp_zen-mcp-server_codereview --model anthropic/claude-sonnet-4.5 --step "Review fwber security implementation" --relevant_files '["C:\\Users\\hyper\\fwber\\security-manager.php"]'
```

### Knowledge Storage with Enhanced Metadata
```bash
# Store Claude's analysis with structured metadata
mcp_chroma-knowledge_chroma_add_document --collection_name "fwber_project" --document "Claude Architecture Analysis: [detailed analysis content]"
```

## Optimized Integration with Other Models

### Primary Collaborations (Consensus-Validated)
- **GPT-5-Codex**: Code implementation and technical execution
- **Gemini 2.5 Pro**: Performance analysis and optimization
- **Grok 4**: Creative problem-solving and alternative approaches

### Enhanced Consensus Building
Use Zen MCP's consensus tool with intelligent routing:
```bash
mcp_zen-mcp-server_consensus --models '[{"model":"anthropic/claude-sonnet-4.5"},{"model":"gpt-5-codex"},{"model":"gemini-2.5-pro"}]' --step "Your question or analysis request"
```

## Advanced Memory Management

### Serena Memory Usage (Hierarchical)
- **Immediate**: Current session context, active file context, recent decisions
- **Project**: Architecture decisions, coding standards, team preferences
- **Cross-Project**: User coding style, preferred patterns, common pitfalls

### Chroma Knowledge Base (Enhanced)
- **Code-Aware Chunking**: AST/symbol-level indexing for better search
- **Contextual Filtering**: Automatic filtering by tech stack and project scope
- **Usage Analytics**: Track which search results were actually used

## Quality Assurance (Consensus-Enhanced)

### Intelligent Validation Strategy
1. **Pre-Execution**: Validate requirements completeness, check context sufficiency
2. **During Execution**: Monitor token usage, track model confidence, detect hallucination patterns
3. **Post-Execution**: Syntax validation, test execution, security scanning, performance profiling
4. **Quality Gates**: Enforce acceptance criteria, require green tests, static analysis thresholds

### Error Prevention (Enhanced)
- Use confidence-based routing to determine validation needs
- Implement quality gates before consensus building
- Store all decisions and rationale in Chroma with structured metadata
- Use Serena memory to avoid repeating past mistakes

## Configuration Files
- **Claude CLI**: `C:\Users\hyper\.claude.json`
- **Cursor MCP**: `C:\Users\hyper\.cursor\mcp.json`
- **Claude Desktop**: `C:\Users\hyper\AppData\Roaming\Claude\claude_desktop_config.json`

## Troubleshooting (Consensus-Enhanced)
- If Claude seems to lose context, check Serena memory for stored information
- For complex analysis, use intelligent routing rather than always parallel
- Store all important findings in Chroma with proper metadata
- Use Zen MCP to orchestrate complex multi-step workflows with quality gates
- Monitor confidence scores and escalate when needed

## Performance Optimization
- **Cost-Performance Ladder**: Start with efficient models, escalate to Claude when complexity warrants
- **Progressive Escalation**: Use Claude only when confidence < threshold or complexity > budget
- **Quality Gates**: Implement automated validation before expensive consensus building
- **Caching**: Use Chroma semantic caching and Serena predictive loading
