import { framework } from '../test-framework.js';

// This runs after all test suites have completed
after(async function() {
  console.log('\nCleaning up test framework...');

  await framework.callTool('close', {});

  await framework.cleanup();
  console.log('Cleanup complete.');

  // Exit after a short delay to ensure cleanup completes
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
