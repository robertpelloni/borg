# Codex Debugging Skill

This skill allows the agent to consult OpenAI Codex for root cause analysis of bugs.

## Slash Command

`/codex investigate <bug description>`

## Usage

When the user invokes this command, follow these steps:

1.  **Context Analysis:** Review the recent conversation and user query to understand the bug, file locations, and what has been attempted.
2.  **Construct Prompt:** Create a detailed prompt for Codex using the template below.
3.  **Execute:** Use the `bash` tool to run the `codex` CLI command. **Crucially**, run it synchronously (no background) and with a long timeout.
4.  **Report:** Parse the output and present the "Codex Analysis" section to the user.

## Command Template

```bash
codex exec -m gpt-5 -c model_reasoning_effort="high" --sandbox read-only "
# Bug Investigation Request

## Issue
[Brief description]

## Context
- **File(s):** [path/to/file:line]
- **Behavior:** [Observed vs Expected]
- **Tried:** [Previous attempts]

## Question
What is the root cause? Provide analysis and suggested fix.
"
```

## Important Safety Rules
- Always use `--sandbox read-only`.
- Never allow Codex to edit files directly via this command.
- Set a timeout of 600000ms (10 minutes).
