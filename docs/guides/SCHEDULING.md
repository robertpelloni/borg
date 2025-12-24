# Task Scheduling

The Super AI Plugin includes a `SchedulerManager` that allows you to run MCP Tools or Agents on a recurring schedule (Cron).

## Configuration

Schedules are stored in `scheduler.json` in the root directory.

### Example `scheduler.json`

```json
[
  {
    "id": "1",
    "name": "Daily Cleanup",
    "cron": "0 0 * * *",
    "type": "tool",
    "target": "filesystem__delete_file",
    "args": { "path": "/tmp/junk.txt" },
    "enabled": true
  },
  {
    "id": "2",
    "name": "Morning Briefing",
    "cron": "0 8 * * *",
    "type": "agent",
    "target": "briefing_agent",
    "args": { "task": "Summarize the latest PRs" },
    "enabled": true
  }
]
```

## Features

*   **Persistence:** Tasks are saved to disk.
*   **Live Updates:** The scheduler reloads when the file changes (via API/UI interactions).
*   **Logging:** Execution results are emitted via Socket.io to the Dashboard.

## API

*   `GET /api/state`: Includes `scheduledTasks`.
*   (Future) `POST /api/scheduler/add`: Endpoint to programmatically add tasks.
