import React, { useRef, useEffect } from 'react';
import { useSessionKeeperStore, Log } from '@/lib/stores/session-keeper';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';

interface SessionKeeperLogPanelProps {
  onClose?: () => void;
}

export function SessionKeeperLogPanel({ onClose }: SessionKeeperLogPanelProps) {
  const { logs, clearLogs } = useSessionKeeperStore();

  return (
    <div className="flex flex-col h-full bg-background border-t">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          Session Keeper Activity Log
          <span className="text-xs font-normal text-muted-foreground">({logs.length} events)</span>
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={clearLogs}
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onClose}
              title="Close panel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-0">
          <table className="w-full text-xs text-left">
            <thead className="text-muted-foreground bg-muted/20 sticky top-0">
              <tr>
                <th className="px-4 py-2 font-medium w-24">Time</th>
                <th className="px-4 py-2 font-medium w-20">Type</th>
                <th className="px-4 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No activity recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log: Log, index: number) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-muted/30 font-mono">
                    <td className="px-4 py-1.5 whitespace-nowrap text-muted-foreground">
                      {log.time}
                    </td>
                    <td className="px-4 py-1.5 whitespace-nowrap">
                      <BadgeForType type={log.type} />
                    </td>
                    <td className="px-4 py-1.5 break-all">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}

function BadgeForType({ type }: { type: Log['type'] }) {
  const styles = {
    info: 'text-blue-500',
    action: 'text-green-500 font-bold',
    error: 'text-red-500 font-bold',
    skip: 'text-gray-400',
  };

  return (
    <span className={styles[type] || ''}>
      {type.toUpperCase()}
    </span>
  );
}
