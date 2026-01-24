# Auto-Drive Mode 🚗💨

**Auto-Drive** is the fully autonomous mode for the Borg Director. It allows the AI to "drive" the development loop by reading tasks, planning actions, and executing them without manual user intervention.

## How it Works

1.  **Reading Tasks:** The Director monitors `task.md` for unchecked items (`[ ]`).
2.  **Autonomous Execution:** It uses its tools (file editing, terminal commands, web browsing) to implement the task.
3.  **Council Oversight:** If the **Autonomy Level** is set to `medium` or `low`, the Director consults the **Council** (Architect, Guardian) before taking risks. In `high` autonomy, it proceeds instantly.
4.  **Auto-Accept:** The "Manager Mode" feature automatically presses "Accept" (Alt+Enter) in the IDE to approve AI suggestions, enabling a truly hands-free experience.

## Usage

### 1. Start Auto-Drive

Run the script to inject the specific prompt into the Director's context:

```bash
npx tsx scripts/start_auto_drive.ts
```

The Director will assume control and begin processing the next task in `task.md`.

### 2. Autonomy Levels

You can set the autonomy level via the **Dashboard** or using the MCP tool:

- **Low:** Asks for permission for almost everything.
- **Medium:** Asks for finding files or risky edits.
- **High:** Full trust. Auto-approves file writes and commands.

### 3. Stopping

To stop Auto-Drive, simply kill the `npx` process or the `borg-cli` server.

## Tips

- Keep `task.md` detailed. The Director relies on it for instructions.
- Ensure `process.env` keys (OPENAI, etc.) are set for the Council to debate effectively.
