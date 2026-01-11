
// Connection state enum
export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RETRYING: 'retrying',
  ERROR: 'error'
};

// Message class
export class Message {
  constructor(direction, data) {
    this.id = crypto.randomUUID();
    this.direction = direction; // 'incoming' | 'outgoing'
    this.data = data;
    this.timestamp = new Date();
  }
}

// Console log entry class
export class ConsoleLogEntry {
  constructor(level, args, stackTrace = null) {
    this.id = crypto.randomUUID();
    this.level = level; // 'log' | 'info' | 'warn' | 'error'
    this.args = args;
    if (stackTrace) {
      this.stackTrace = stackTrace;
    }
    this.timestamp = new Date();
  }
}

