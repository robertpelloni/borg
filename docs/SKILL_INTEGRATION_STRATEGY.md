# Universal Skill Integration Strategy

## Objective
To aggregate, normalize, and expose capabilities (skills) from diverse sources (Anthropic, OpenAI, community repos) into a unified, platform-agnostic registry available to all AIOS agents.

## 1. Source Aggregation
We have established a `references/skills_repos` directory to mirror external skill collections as git submodules.

**Current Sources:**
*   `references/skills_repos/anthropic-skills` (Official Anthropic)
*   `references/skills_repos/openai-skills` (Official OpenAI)
*   `references/skills_repos/awesome-llm-skills` (Community List)

## 2. Normalization Standard (The "Universal Skill Format")
All skills must be converted to a standard JSON schema compatible with MCP `tools` and OpenAI `functions`.

**Schema (Draft):**
```json
{
  "id": "skill_namespace_name",
  "name": "Human Readable Name",
  "description": "Clear description for the LLM",
  "parameters": { ...JSON Schema... },
  "implementation": {
    "type": "python|typescript|bash",
    "source": "path/to/script.py"
  },
  "metadata": {
    "origin": "anthropic-skills",
    "license": "MIT"
  }
}
```

## 3. Implementation Plan

### Phase 1: Indexing (Immediate)
- [ ] Create `scripts/index_skills.ts`.
- [ ] Scan `references/skills_repos/**/*.py` and `**/*.js`.
- [ ] Extract function signatures using AST parsing.
- [ ] Generate a `skills_index.json` registry file.

### Phase 2: Execution Adapter
- [ ] Build a generic "Skill Runner" tool (`run_skill`).
- [ ] Implement sandboxing (using existing `isolated-vm` or Docker logic) to execute untrusted skill code.
- [ ] Map inputs from the standardized schema to the native script arguments.

### Phase 3: Marketplace
- [ ] Expose the registry via the MCP server.
- [ ] Allow agents to "install" skills (dynamic loading).

## 4. Directory Structure
```
packages/core/
  src/
    skills/
      registry.json  <-- The Index
      adapters/      <-- Converters (Anthropic -> AIOS, OpenAI -> AIOS)
      runner.ts      <-- Execution Logic
```
