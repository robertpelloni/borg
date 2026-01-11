// Import helper functions from background-commands
import { respondWith, respondWithError } from './background-commands.js';

export async function getLogs(tabState, { before, limit = 100, level }) {
  try {
    // Get the logs from the tab state using its built-in method
    const logs = tabState.getConsoleLogs(limit, level, before);

    // Check if there are more logs available
    const totalFilteredCount = tabState.getConsoleLogs(null, level, before).length;
    const hasMore = totalFilteredCount > limit;

    return respondWith(tabState.tabId, {
      logs: logs,
      hasMore: hasMore,
      totalCount: tabState.getConsoleLogCount()
    });
  } catch (error) {
    return respondWithError(tabState.tabId, 'CONSOLE_LOG_ERROR', error.message);
  }
}
