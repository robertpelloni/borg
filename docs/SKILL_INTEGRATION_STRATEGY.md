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

### Phase 3: Marketplace (In Progress)
- [x] Expose the registry via the MCP server.
    - Implemented `SkillRegistryServer` with tools: `list_skills`, `get_skill_info`, `execute_skill`.
    - Created entry point `packages/core/bin/skill-registry-server.ts`.
- [ ] **Next Step:** Integrate this MCP server into the main AIOS agent runtime so agents can auto-discover it.
- [ ] Allow agents to "install" skills (dynamic loading).

## 4. Analysis of Skill Types
...
### Type C: "Knowledge/Reference" Skills (e.g., `brand-guidelines`)
*   **Structure:** `SKILL.md` essentially acting as a knowledge base entry.
*   **Execution:** Handled by `PromptDriver` (same as Type A).
*   **Status:** Working.

## 6. MCP Server Tools
The new `SkillRegistryServer` provides:
*   `list_skills()`: Returns JSON list of all 26 skills.
*   `get_skill_info(skill_id)`: Returns full metadata + type info.
*   `execute_skill(skill_id, params)`: 
    *   For Prompt skills: Returns the prompt content.
    *   For Script skills: Executes the script and returns stdout.

## 7. Known Issues
*   **Security:** `PythonExecutor` is not sandboxed.
*   **Parameter Mapping:** `execute_skill` takes a generic `params` object. We blindly convert this to command line args (e.g. `{foo: "bar"}` -> `--foo bar`). This works for many CLI tools but not all. We need a rigorous schema mapper in Phase 4.



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
