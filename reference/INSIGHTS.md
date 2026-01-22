
# Borg Insights & Findings (Jan 2026 Context)

## 1. Key Technology Shifts
*   **Zeroshot Standard:** The `covibes/zeroshot` model (Planner -> Worker -> Blind Validator) is the new gold standard for autonomous engineering. It prevents "lazy coding" by enforcing a validation step where the validator has no prior knowledge of the implementation detail, only the spec.
*   **Workty Isolation:** `binbandit/workty` usage (Git Worktrees as "Browser Tabs") is essential for reducing context switching overhead. Borg should treat every task as a potential worktree.
*   **Dev Browser:** `SawyerHood/dev-browser` has superseded stateless tools like Playwright. Maintaining cookies, local storage, and open tabs between agent turns is critical for complex web interactions.

## 2. Hardware & Model Consensus
*   **Gemini 3 Flash:** The preferred "Worker" model. Fast, cheap, slightly hallucinatory on file paths (needs validation), but excellent for bulk code generation.
*   **Opus 4.5:** The "Architect/Supervisor". Too expensive for loops, but perfect for high-level planning and code review.
*   **Local Inference:** High-end consumer hardware (Ryzen 9 7950X, RTX 5080 with 32GB VRAM mod) allows for local 70B model inference, reducing reliance on cloud APIs for privacy-sensitive tasks.

## 3. Emerging Patterns
*   **Ralph Loop:** Plan -> Act -> Fail -> Retry. Simple but effective for dependency hell.
*   **Vibe Coding:** High-speed, intuitive coding ("Flow State") burns tokens rapidly. Credit management is a UX priority.
*   **One Reviewer, Three Lenses:** Instead of 3 separate reviewer agents, use 1 agent with 3 distinct system prompts (Security, Performance, Style) to review code.
*   **Terminal Tabs:** Agents need to manage their own terminal multiplexing (like Tmux) to run servers, tests, and editors simultaneously.

## 4. User Directives
*   **Total Feature Parity:** Goal is to absorb functionality from all 432 indexed tools, especially `Metamcp` and `Jules Autopilot` forks.
*   **No Forks:** Functionality moves TO Core; Forks become upstream references only.
*   **Automatic Fallback:** Critical need for "Quota Awareness". If Gemini 3 Flash hits limit -> Switch to GPT-4o -> Switch to Opus -> etc.
