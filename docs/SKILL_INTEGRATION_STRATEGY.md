# Universal Skill Integration Strategy

## Objective
To aggregate, normalize, and expose capabilities (skills) from diverse sources (Anthropic, OpenAI, community repos) into a unified, platform-agnostic registry available to all borg agents.

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

### Phase 1: Indexing (Completed)
- [x] Create `scripts/index_skills.ts`.
- [x] Scan `references/skills_repos`.
- [x] Parse `SKILL.md` metadata.
- [x] Generate `skills_registry.json`.

### Phase 2: Execution Adapter (Completed)
- [x] Analyze skill types (Prompt-based vs Code-based).
- [x] Implement `SkillManager` in `packages/core/src/managers/SkillManager.ts`.
- [x] Define "Execution Drivers" (`PromptDriver`, `ScriptDriver`).
- [x] Integrate with `CodeExecutionManager` for JS scripts.
- [x] Implement `PythonExecutor` in `packages/core/src/managers/PythonExecutor.ts` to handle OpenAI skills.
- [x] Verify execution of both Skill Types.

### Phase 3: Marketplace (Completed)
- [x] Expose the registry via the MCP server.
- [x] Integrate `SkillRegistryServer` into `MarketplaceManager`.
- [x] Verify that `McpManager` can start the registry server and clients can discover tools.

### Phase 4: Dynamic Agent Loading (Next)
- [ ] Create an Agent that uses `execute_skill` to solve a task.
- [ ] Implement `install_skill` in `MarketplaceManager` to fetch new skills from remote URLs (currently mocked).

## 6. MCP Server Tools
The `SkillRegistryServer` is now a core component, started automatically by `MarketplaceManager`.
Tools available to all agents:
*   `list_skills`
*   `get_skill_info`
*   `execute_skill`

## 7. Known Issues
*   **Security:** `PythonExecutor` is not sandboxed.
*   **Stdio Noise:** Console logs from `SkillManager` were breaking MCP protocol. Fixed by commenting out logs, but we need a better logging strategy (stderr vs stdout).




### Type C: "Knowledge/Reference" Skills (e.g., `brand-guidelines`)
*   **Structure:** `SKILL.md` essentially acting as a knowledge base entry.
*   **Execution:** Handled by `PromptDriver` (same as Type A).
*   **Status:** Working.

## 5. Directory Structure
```
packages/core/
  data/
    skills_registry.json  <-- Generated Index
  src/
    managers/
        SkillManager.ts   <-- Main Entry Point
    skills/
        types.ts          <-- Skill Definitions
        drivers/
            PromptDriver.ts
            ScriptDriver.ts
```
