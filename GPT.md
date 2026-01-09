# GPT AI Model Documentation

## Overview
GPT (Generative Pre-trained Transformer) is OpenAI's advanced AI model family, known for its strong code generation capabilities, technical implementation skills, and ability to execute complex programming tasks with high accuracy.

## Available Models
- **GPT-5** (gpt-5) - Latest version with enhanced reasoning and code generation
- **GPT-5-Pro** (gpt-5-pro) - High-performance model with advanced capabilities
- **GPT-5-Codex** (gpt-5-codex) - Specialized for code generation and technical implementation
- **GPT-4o** (gpt-4o) - Multimodal model with vision capabilities
- **GPT-4o-mini** (gpt-4o-mini) - Efficient model for simpler tasks

## Key Strengths
- **Code Generation**: Exceptional at generating high-quality, production-ready code
- **Technical Implementation**: Strong at implementing complex algorithms and system components
- **API Integration**: Proficient at working with various APIs and frameworks
- **Database Operations**: Excellent at SQL queries, database design, and data manipulation
- **System Architecture**: Strong at designing and implementing scalable systems
- **Testing**: Proficient at writing comprehensive test suites and debugging code

## MCP Server Integration

### Using Zen MCP for Orchestration
```bash
# Access GPT through Zen MCP server
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Implement fwber matching algorithm with advanced features"
```

### Using Serena MCP for Code Context
```bash
# Store code patterns and implementation strategies in Serena memory
mcp_serena_write_memory --memory_name "gpt_implementations" --content "Code patterns and implementation strategies for fwber"

# Retrieve code context
mcp_serena_read_memory --memory_file_name "gpt_implementations"
```

### Using Chroma MCP for Code Storage
```bash
# Store code implementations in Chroma
mcp_chroma-knowledge_chroma_add_document --collection_name "code_implementations" --document "GPT: fwber matching algorithm implementation..."
```

## Best Practices for GPT

### 1. Always Work in Parallel
- **Before implementation**: Get input from Claude and Gemini 2.5 Pro on architecture and requirements
- **During coding**: Use consensus building for complex technical decisions
- **After implementation**: Have Claude validate code quality and security

### 2. Leverage MCP Servers
- **Serena**: Store code patterns, implementation strategies, and technical solutions
- **Chroma**: Maintain comprehensive repository of code implementations and technical documentation
- **Zen**: Orchestrate multi-model code development and validation workflows

### 3. Specialized Use Cases
- **Code Generation**: Primary tool for implementing features and algorithms
- **API Development**: Excellent at creating REST APIs, GraphQL endpoints, and microservices
- **Database Design**: Strong at schema design, query optimization, and data modeling
- **System Integration**: Proficient at connecting different system components
- **Testing**: Expert at writing unit tests, integration tests, and test automation

### 4. Collaboration Workflow
```
1. Planning: Claude + Gemini 2.5 Pro define technical requirements and architecture
2. Implementation: GPT generates code and implements features
3. Review: Claude validates code quality and security
4. Testing: GPT writes comprehensive test suites
5. Storage: Save implementations in Chroma knowledge base
6. Memory: Update Serena with code patterns and strategies
```

## Example Commands

### Code Generation
```bash
# Generate comprehensive code implementation
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Implement a scalable matching algorithm for fwber with Redis caching and real-time updates"
```

### API Development
```bash
# Create REST API endpoints
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Design and implement REST API endpoints for fwber user management with authentication and rate limiting"
```

### Database Operations
```bash
# Database schema and queries
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Design optimized database schema for fwber with spatial indexing for location-based matching"
```

### Testing Implementation
```bash
# Comprehensive test suite
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Write comprehensive test suite for fwber matching algorithm including unit tests, integration tests, and performance tests"
```

### Knowledge Storage
```bash
# Store code implementations
mcp_chroma-knowledge_chroma_add_document --collection_name "fwber_project" --document "GPT Code Implementation: [detailed code content]"
```

## Integration with Other Models

### Primary Collaborations
- **Claude**: Code review, security validation, and architectural guidance
- **Gemini 2.5 Pro**: Performance analysis and optimization recommendations
- **Grok 4**: Creative problem-solving and innovative approaches

### Consensus Building for Implementation
Always use Zen MCP's consensus tool for complex technical decisions:
```bash
mcp_zen-mcp-server_consensus --models '[{"model":"gpt-5-codex","stance":"for"},{"model":"anthropic/claude-sonnet-4.5","stance":"neutral"},{"model":"gemini-2.5-pro","stance":"against"}]' --step "Evaluate microservices vs monolith architecture for fwber implementation"
```

## Memory Management

### Serena Memory Usage
- Store code patterns and implementation strategies
- Maintain technical solution repositories
- Track successful implementation approaches

### Chroma Knowledge Base
- Store all code implementations and technical solutions
- Maintain searchable repository of code patterns
- Enable semantic search across technical knowledge

## Quality Assurance

### Always Validate with Other Models
1. **Implementation**: GPT generates code and implements features
2. **Code Review**: Claude validates code quality and security
3. **Performance Analysis**: Gemini 2.5 Pro analyzes performance implications
4. **Creative Validation**: Grok 4 provides alternative approaches
5. **Consensus Building**: Use Zen MCP to resolve technical disagreements
6. **Final Validation**: Store in Chroma and update Serena memory

### Code Quality Standards
- Always follow best practices and coding standards
- Implement comprehensive error handling and validation
- Write clear, documented, and maintainable code
- Use multi-model validation for critical implementations

## Configuration Files
- **GPT CLI**: `C:\Users\hyper\.gpt\settings.json`
- **OpenAI API**: `C:\Users\hyper\.openai\config.json`

## Specialized Tools

### Code Generation
```bash
# Generate production-ready code
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Implement a complete user authentication system for fwber with JWT tokens, password hashing, and session management"
```

### API Development
```bash
# Create comprehensive API
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Design and implement a complete REST API for fwber with endpoints for user management, matching, and messaging"
```

### Database Operations
```bash
# Database implementation
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Implement database operations for fwber with optimized queries, indexing, and data validation"
```

### Testing Implementation
```bash
# Comprehensive testing
mcp_zen-mcp-server_chat --model gpt-5-codex --prompt "Write complete test suite for fwber including unit tests, integration tests, and end-to-end tests"
```

## Advanced Features

### Code Generation
- Generate production-ready code with proper error handling
- Implement complex algorithms and data structures
- Create scalable and maintainable code architectures

### API Development
- Design RESTful APIs with proper HTTP methods and status codes
- Implement authentication and authorization mechanisms
- Create comprehensive API documentation

### Database Operations
- Design optimized database schemas
- Write efficient SQL queries and stored procedures
- Implement database migrations and versioning

### System Integration
- Connect different system components and services
- Implement message queues and event-driven architectures
- Create microservices and distributed systems

## Troubleshooting
- If code generation seems incomplete, validate with Claude for quality
- For complex implementations, always use multi-model consensus
- Store all code implementations in Chroma for future reference
- Use Zen MCP to orchestrate comprehensive development workflows
- Balance technical implementation with practical requirements
