# Universal Skill Format Strategy

## Overview
We need to standardize skills from different providers (Anthropic, OpenAI) into a single JSON format that the borg Core can execute.

## Source Analysis

### Anthropic Skills
*   **Location:** `references/skills_repos/anthropic-skills/skills`
*   **Format:** Folder per skill.
*   **Metadata:** `SKILL.md` (YAML frontmatter with name, description).
*   **Implementation:** Variable (Python scripts, JS templates, etc.).
*   **Example:** `algorithmic-art` has `SKILL.md` and `templates/`.

### OpenAI Skills
*   **Location:** `references/skills_repos/openai-skills/skills`
*   **Categories:** `.curated`, `.experimental`, `.system`
*   **Format:** Folder per skill.
*   **Metadata:** Likely in `README.md` or `skill.json` (need to verify).

## Universal Schema (v1)

```json
{
  "id": "provider_namespace_skillname",
  "name": "Human Readable Name",
  "description": "Description for the LLM",
  "provider": "anthropic|openai",
  "category": "curated|experimental|system|community",
  "path": "relative/path/to/skill/root",
  "entrypoint": "path/to/script.py", 
  "parameters": {
    // JSON Schema for arguments
  }
}
```

## Next Steps
1.  **Scanner Script:** Write `scripts/scan_skills.ts` to walk these directories.
2.  **Parser:**
    *   For Anthropic: Parse `SKILL.md` frontmatter.
    *   For OpenAI: Inspect `skill.json` or `README.md` in each folder.
3.  **Registry:** Save to `packages/core/data/skills_registry.json`.
