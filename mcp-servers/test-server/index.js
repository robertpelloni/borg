console.log('Mock MCP Server Started');

// Keep the process alive to simulate a long-running server
const interval = setInterval(() => {
  // Heartbeat or no-op
}, 5000);

// distinct message to indicate readiness if needed
console.log('Test Server Running...');

// Graceful shutdown on SIGTERM/SIGINT
const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
