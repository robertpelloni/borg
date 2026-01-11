import { WebSocket } from 'ws';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger.js';

export class WebSocketTransport implements Transport {
  private _onclose?: () => void;
  private _onerror?: (error: Error) => void;
  private _onmessage?: (message: JSONRPCMessage) => void;

  constructor(private ws: WebSocket) {
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as JSONRPCMessage;
        logger.log(`MCP IN: ${JSON.stringify(message)}`);

        if (this._onmessage) {
          this._onmessage(message);
        }
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', error);
        if (this._onerror) {
          this._onerror(new Error('Failed to parse message'));
        }
      }
    });

    this.ws.on('close', () => {
      logger.log('WebSocket transport closed');
      if (this._onclose) {
        this._onclose();
      }
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket transport error:', error);
      if (this._onerror) {
        this._onerror(error);
      }
    });
  }

  async start(): Promise<void> {
    // WebSocket is already connected
    // logger.log('WebSocket transport started');
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    // Ensure notifications have the proper format
    if (!('id' in message) && 'method' in message) {
      // This is a notification - ensure it has jsonrpc field
      const notification = {
        jsonrpc: '2.0',
        method: (message as any).method,
        params: (message as any).params
      };
      const messageStr = JSON.stringify(notification);
      logger.log(`MCP OUT: ${messageStr}`);
      this.ws.send(messageStr);
    } else {
      const messageStr = JSON.stringify(message);
      logger.log(`MCP OUT: ${messageStr}`);
      this.ws.send(messageStr);
    }
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  set onclose(handler: () => void) {
    this._onclose = handler;
  }

  set onerror(handler: (error: Error) => void) {
    this._onerror = handler;
  }

  set onmessage(handler: (message: JSONRPCMessage) => void) {
    this._onmessage = handler;
  }
}
