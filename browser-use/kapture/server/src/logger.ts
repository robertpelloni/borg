import * as fs from 'fs';
import * as path from 'path';

// Logger that writes to stderr or a file instead of stdout
// This prevents interference with MCP protocol on stdout

class Logger {
  private logFile?: fs.WriteStream;
  
  // ANSI color codes
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
  };

  constructor() {
    // Check if we should log to file
    if (process.env.KAPTURE_LOG_FILE) {
      this.logFile = fs.createWriteStream(process.env.KAPTURE_LOG_FILE, { flags: 'a' });
    }
  }

  private colorize(color: keyof typeof this.colors, text: string): string {
    // Only colorize for stderr output, not file output
    if (this.logFile || process.env.NO_COLOR) {
      return text;
    }
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  log(...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    const timestamp = new Date().toISOString();
    
    if (this.logFile) {
      const logLine = `[${timestamp}] ${message}\n`;
      this.logFile.write(logLine);
    } else {
      const coloredTimestamp = this.colorize('gray', `[${timestamp}]`);
      const logLine = `${coloredTimestamp} ${message}\n`;
      process.stderr.write(logLine);
    }
  }

  error(...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    const timestamp = new Date().toISOString();
    
    if (this.logFile) {
      const logLine = `[${timestamp}] ERROR: ${message}\n`;
      this.logFile.write(logLine);
    } else {
      const coloredTimestamp = this.colorize('gray', `[${timestamp}]`);
      const coloredError = this.colorize('red', 'ERROR:');
      const logLine = `${coloredTimestamp} ${coloredError} ${message}\n`;
      process.stderr.write(logLine);
    }
  }

  warn(...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    const timestamp = new Date().toISOString();
    
    if (this.logFile) {
      const logLine = `[${timestamp}] WARN: ${message}\n`;
      this.logFile.write(logLine);
    } else {
      const coloredTimestamp = this.colorize('gray', `[${timestamp}]`);
      const coloredWarn = this.colorize('yellow', 'WARN:');
      const logLine = `${coloredTimestamp} ${coloredWarn} ${message}\n`;
      process.stderr.write(logLine);
    }
  }

}

export const logger = new Logger();
