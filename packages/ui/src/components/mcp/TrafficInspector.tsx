'use client';

import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Pause, Play, Search, ArrowUp, ArrowDown, Bell } from 'lucide-react';

interface TrafficFrame {
  id: string;
  timestamp: number;
  direction: 'request' | 'response' | 'notification';
  serverId: string;
  method?: string;
  data: any;
  latency?: number;
  correlatedId?: string;
}

export function TrafficInspector() {
  const [frames, setFrames] = useState<TrafficFrame[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [serverFilter, setServerFilter] = useState('all');

  const fetchFrames = async () => {
    if (isPaused) return;
    try {
      const res = await fetch('/api/traffic');
      const data = await res.json();
      // Reverse to show newest first
      setFrames(data.frames.reverse());
    } catch (e) {
      console.error('Failed to fetch traffic:', e);
    }
  };

  useEffect(() => {
    fetchFrames();
    const interval = setInterval(fetchFrames, 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const clearTraffic = async () => {
    await fetch('/api/traffic', { method: 'DELETE' });
    setFrames([]);
  };

  const filteredFrames = frames.filter(f => {
    if (methodFilter !== 'all' && f.method !== methodFilter) return false;
    if (serverFilter !== 'all' && f.serverId !== serverFilter) return false;
    if (filter) {
      const searchStr = JSON.stringify(f).toLowerCase();
      return searchStr.includes(filter.toLowerCase());
    }
    return true;
  });

  const uniqueMethods = Array.from(new Set(frames.map(f => f.method).filter(Boolean)));
  const uniqueServers = Array.from(new Set(frames.map(f => f.serverId)));

  return (
    <div className="flex flex-col h-[600px] bg-gray-900 rounded-xl border border-gray-800">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search size={18} /> Traffic Inspector
          </h2>
          <Badge variant="outline" className="bg-gray-800">{frames.length} frames</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearTraffic} className="text-red-400 hover:text-red-300">
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 border-b border-gray-800 bg-gray-900/50">
        <Input 
          placeholder="Search payload..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 bg-gray-800 border-gray-700"
        />
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="h-8 w-[150px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {uniqueMethods.map(m => <SelectItem key={m} value={m!}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={serverFilter} onValueChange={setServerFilter}>
          <SelectTrigger className="h-8 w-[150px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Server" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Servers</SelectItem>
            {uniqueServers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {filteredFrames.map((frame) => (
            <div key={frame.id} className="bg-gray-800/50 rounded-lg p-3 text-sm font-mono border border-gray-700/50 hover:border-gray-600 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {frame.direction === 'request' && <Badge variant="outline" className="text-blue-400 border-blue-400/30"><ArrowUp size={12} className="mr-1"/> REQ</Badge>}
                  {frame.direction === 'response' && <Badge variant="outline" className="text-green-400 border-green-400/30"><ArrowDown size={12} className="mr-1"/> RES</Badge>}
                  {frame.direction === 'notification' && <Badge variant="outline" className="text-yellow-400 border-yellow-400/30"><Bell size={12} className="mr-1"/> NOT</Badge>}
                  
                  <span className="text-gray-400">{new Date(frame.timestamp).toLocaleTimeString()}</span>
                  <span className="font-bold text-gray-200">{frame.serverId}</span>
                </div>
                {frame.latency && <span className="text-xs text-gray-500">{frame.latency}ms</span>}
              </div>
              
              {frame.method && <div className="text-purple-400 font-bold mb-1">{frame.method}</div>}
              
              <div className="bg-gray-950 rounded p-2 overflow-x-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(frame.data, null, 2)}
                </pre>
              </div>
            </div>
          ))}
          {filteredFrames.length === 0 && (
            <div className="text-center text-gray-500 py-8">No traffic captured</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
