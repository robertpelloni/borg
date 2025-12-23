# Prompt Engineering Integration Strategy

This document outlines the plan to integrate Anthropic's official prompt engineering tools and best practices directly into the "Super AI Plugin" UI.

**Reference:** `references/prompt-eng-tutorial` (Submodule)

## 1. Core Features to Integrate

### A. Prompt Improver & Modifiers
*   **Goal:** Automatically refine user prompts based on Anthropic's guidelines (Clarity, XML Tags, Role prompting) and Gemini strategies.
*   **Implementation:**
    *   Create a `refine_prompt` tool exposed via MCP.
    *   Use the "Prompt Generator" logic (metaprompt) to rewrite inputs.
    *   **UI Features:**
        *   "Magic Wand" button to optimize drafts.
        *   **Slash Commands / Shortcuts:** Implement modifiers like `/ELI5`, `/ACT AS`, `/CHAIN OF THOUGHT` (Reference: [Prompt Shortcuts](https://gist.github.com/Richard-Weiss/efe157692991535403bd7e7fb20b6695)).
        *   **Thoughtbox:** Integrate [`thoughtbox`](https://github.com/Kastalien-Research/thoughtbox) logic to guide users in structuring complex thoughts before prompting.

### B. Interactive Tutorial & Eval
*   **Goal:** Teach users how to write better prompts and evaluate their effectiveness.
*   **Implementation:**
    *   Port the `prompt-eng-interactive-tutorial` content into a "Learning Mode" in the Dashboard.
    *   Integrate the "Eval Tool" logic to run test cases against prompts.

### C. Template Management
*   **Goal:** Manage prompt templates and variables.
*   **Implementation:**
    *   Enhance `packages/core/src/managers/PromptManager.ts` to support variable interpolation (`{{variable}}`).
    *   UI: A "Template Library" view to browse and instantiate templates.

## 2. Guidelines & Standards
We will strictly adhere to the official documentation:
*   [Be Clear and Direct](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/be-clear-and-direct)
*   [Use XML Tags](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)
*   [Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/extended-thinking-tips)

## 3. Workflow
1.  **Draft:** User types a rough request.
2.  **Refine:** User clicks "Improve". System uses the Metaprompt to structure the request with XML tags and clearer instructions.
3.  **Evaluate:** (Optional) User runs the prompt against a small test set (Eval Tool) to verify performance.
4.  **Execute:** The optimized prompt is sent to the Agent.
