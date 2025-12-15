console.log('Mock MCP Server Started');

// Keep the process alive to simulate a long-running server
setInterval(() => {
  // Heartbeat or no-op
}, 5000);

// distinct message to indicate readiness if needed
console.error('Test Server Running...');
