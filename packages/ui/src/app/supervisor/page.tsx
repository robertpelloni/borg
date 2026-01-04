'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { io } from 'socket.io-client';
import { Badge } from '@/components/ui/badge';
import { Terminal, Play, AlertCircle, CheckCircle2, Activity, Cpu } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export default function SupervisorPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [task, setTask] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002');

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Supervisor Socket');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('supervisor:log', (log: LogEntry) => {
      setLogs(prev => [...prev, log]);
    });

    socket.on('supervisor:status', (newStatus: string) => {
      setStatus(newStatus);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom on new logs
    if (scrollRef.current) {
        // Find the viewport element inside ScrollArea (radix-ui structure usually wraps content)
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [logs]);

  const startTask = async () => {
    if (!task) return;
    
    setLogs([]);
    
    try {
      const res = await fetch('http://localhost:3002/api/supervisor/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (e) {
      alert('Failed to start task');
    }
  };

  const getIcon = (type: string, message: string) => {
      if (type === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
      if (type === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      if (message.startsWith('Calling tool:')) return <Cpu className="w-4 h-4 text-purple-400" />;
      return <Activity className="w-4 h-4 text-blue-400" />;
  };

  const formatMessage = (message: string) => {
      if (message.startsWith('Calling tool:')) {
          const toolName = message.replace('Calling tool:', '').trim();
          return <span className="text-purple-400">Executing tool: <span className="font-bold text-purple-300">{toolName}</span></span>;
      }
      return message;
  };

  return (
    <div className="container mx-auto p-6 h-screen flex flex-col gap-6 bg-slate-950 text-slate-50">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-bold tracking-tight">Supervisor Dashboard</h1>
        </div>
        <div className="flex gap-2">
            <Badge variant={isConnected ? "default" : "destructive"} className={isConnected ? "bg-green-600 hover:bg-green-700" : ""}>
                {isConnected ? 'Socket Connected' : 'Socket Disconnected'}
            </Badge>
            <Badge variant="outline" className="capitalize border-slate-700 text-slate-300">
                Status: {status}
            </Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <Play className="w-4 h-4" />
            </div>
            <Input 
            value={task} 
            onChange={(e) => setTask(e.target.value)} 
            placeholder="Enter a task for the supervisor (e.g., 'Research the latest AI trends')..." 
            className="pl-10 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && startTask()}
            />
        </div>
        <Button onClick={startTask} disabled={status === 'executing' || !task} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
          {status === 'executing' ? (
              <>
                <Activity className="w-4 h-4 mr-2 animate-spin" />
                Running
              </>
          ) : 'Start Task'}
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden bg-slate-900 border-slate-800 shadow-xl">
        <div className="h-full flex flex-col">
            <div className="p-3 border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 flex justify-between">
                <span>TERMINAL OUTPUT</span>
                <span>{logs.length} events</span>
            </div>
            <ScrollArea className="flex-1 p-4 font-mono text-sm" ref={scrollRef}>
            <div className="space-y-2 pb-4">
                {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
                        <Terminal className="w-8 h-8 opacity-20" />
                        <span className="italic">Ready for instructions...</span>
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className={`flex items-start gap-3 p-2 rounded hover:bg-slate-800/50 transition-colors ${
                        log.type === 'error' ? 'bg-red-950/20 border-l-2 border-red-500' : ''
                    }`}>
                        <span className="text-slate-600 text-xs min-w-[85px] mt-0.5 select-none">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                        </span>
                        <div className="mt-0.5">{getIcon(log.type, log.message)}</div>
                        <span className={`break-all ${
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-green-400' :
                            log.type === 'warning' ? 'text-yellow-400' :
                            'text-slate-300'
                        }`}>
                            {formatMessage(log.message)}
                        </span>
                    </div>
                ))}
            </div>
            </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
