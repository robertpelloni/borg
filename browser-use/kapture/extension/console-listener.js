(function() {
  const isOverridden = !console.log.toString().includes('[native code]');

  // Check if already injected
  if (isOverridden) {
    return;
  }

  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    trace: console.trace,
    table: console.table,
    group: console.group,
    groupCollapsed: console.groupCollapsed,
    groupEnd: console.groupEnd,
    clear: console.clear
  };

  // Helper to serialize arguments
  function serializeArgs(args) {
    return Array.from(args).map(arg => {
      try {
        if (arg === undefined) return 'undefined';
        if (arg === null) return 'null';
        if (typeof arg === 'function') return arg.toString();
        if (typeof arg === 'object') {
          // Handle circular references
          const seen = new WeakSet();
          return JSON.stringify(arg, function(key, value) {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return '[Circular]';
              seen.add(value);
            }
            if (typeof value === 'function') return value.toString();
            return value;
          });
        }
        return String(arg);
      } catch (e) {
        return String(arg);
      }
    });
  }

  // Override console methods (all except clear)
  ['log', 'error', 'warn', 'info', 'debug', 'trace', 'table', 'group', 'groupCollapsed', 'groupEnd'].forEach(level => {
    console[level] = function(...args) {
      // Create log entry
      const detail = {
        level: level,
        args: serializeArgs(args),
        timestamp: new Date().toISOString()
      };

      // Only include stack trace for errors and warnings
      if (level === 'error' || level === 'warn' || level === 'trace') {
        detail.stack = new Error().stack;
      }

      const event = new CustomEvent('kapture-console', { detail });

      // Dispatch event for content script to capture
      window.dispatchEvent(event);

      // Call original method
      originalConsole[level].apply(console, args);
    };
  });

  // Override console.clear
  console.clear = function() {
    // Dispatch clear event
    const event = new CustomEvent('kapture-console', { detail: { level: 'clear' }});
    originalConsole.log('[Kapture] Dispatching console clear event');
    window.dispatchEvent(event);

    // Call original method
    originalConsole.clear.apply(console);
  };

  // Log that injection is complete
  originalConsole.log('[Kapture] Console listener attached');
})();
