import { EventEmitter } from 'events';

export interface TrafficLog {
    id: string;
    timestamp: number;
    type: 'request' | 'response' | 'error';
    tool?: string;
    server?: string;
    args?: any;
    result?: any;
    error?: any;
}

export class LogManager extends EventEmitter {
    public log(entry: Omit<TrafficLog, 'id' | 'timestamp'>) {
        const fullEntry: TrafficLog = {
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            ...entry
        };
        // Emit to subscribers (Socket.io)
        this.emit('log', fullEntry);
    }
}
