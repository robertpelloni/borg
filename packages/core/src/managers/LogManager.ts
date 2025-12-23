import { EventEmitter } from 'events';

export interface TrafficLog {
    id: string;
    timestamp: number;
    source: string;
    destination: string;
    type: 'request' | 'response' | 'notification';
    method?: string;
    payload: any;
}

export class LogManager extends EventEmitter {
    private logs: TrafficLog[] = [];
    private maxLogs = 1000;

    log(entry: Omit<TrafficLog, 'id' | 'timestamp'>) {
        const log: TrafficLog = {
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            ...entry
        };

        this.logs.unshift(log);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        this.emit('log', log);
    }

    getLogs() {
        return this.logs;
    }
}
