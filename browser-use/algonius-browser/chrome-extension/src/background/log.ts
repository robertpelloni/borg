/// <reference types="vite/client" />

type LogLevel = 'debug' | 'info' | 'warning' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warning: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

const createLogger = (namespace: string): Logger => {
  const prefix = `[${namespace}]`;

  return {
    debug: (...args: unknown[]) => {
      if (import.meta.env.DEV) {
        console.debug(prefix, ...args);
      }
    },
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warning: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    group: (label: string) => console.group(`${prefix} ${label}`),
    groupEnd: () => console.groupEnd(),
  };
};

// Create default logger
const logger = createLogger('Agent');

export type { Logger, LogLevel };
export { createLogger, logger };
