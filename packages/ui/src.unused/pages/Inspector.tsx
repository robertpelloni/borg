import React, { useState, useEffect } from 'react';
import { Activity, Play } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
const API_BASE = 'http://localhost:3000';

export const Inspector = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    socket.on('traffic_log', (log: any) => {
      setLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100
    });
    return () => {
      socket.off('traffic_log');
    };
  }, []);

  const replay = async (log: any) => {
      if (log.type !== 'request') return;
      if (!confirm('Replay this tool call?')) return;

      try {
          await fetch(`${API_BASE}/api/inspector/replay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tool: log.tool, args: log.args, server: log.server })
          });
          alert('Replay sent');
      } catch (e: any) {
          alert('Replay failed: ' + e.message);
      }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Traffic Inspector</h1>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
         <div className="p-4 border-b border-gray-700 bg-gray-750 font-medium text-gray-400 grid grid-cols-12 gap-4">
            <div className="col-span-2">Time</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Source/Dest</div>
            <div className="col-span-2">Tool</div>
            <div className="col-span-4">Payload</div>
            <div className="col-span-1">Action</div>
         </div>

         <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
             {logs.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">Waiting for traffic...</div>
             ) : (
                 logs.map(log => (
                     <div key={log.id} className="grid grid-cols-12 gap-4 p-4 text-sm font-mono hover:bg-gray-700/50 transition-colors">
                         <div className="col-span-2 text-gray-500">
                             {new Date(log.timestamp).toLocaleTimeString()}
                         </div>
                         <div className="col-span-1">
                             <span className={`px-2 py-0.5 rounded text-xs ${
                                 log.type === 'request' ? 'bg-blue-500/20 text-blue-400' :
                                 log.type === 'response' ? 'bg-green-500/20 text-green-400' :
                                 'bg-red-500/20 text-red-400'
                             }`}>
                                 {log.type.toUpperCase()}
                             </span>
                         </div>
                         <div className="col-span-2 flex items-center gap-2 text-gray-400">
                             {log.server || 'Hub'}
                         </div>
                         <div className="col-span-2 text-yellow-500 flex items-center gap-2">
                            {log.tool}
                         </div>
                         <div className="col-span-4 truncate text-gray-400 cursor-pointer" title={JSON.stringify(log.args || log.result, null, 2)}>
                             {log.args ? JSON.stringify(log.args) : JSON.stringify(log.result)}
                         </div>
                         <div className="col-span-1 text-right">
                             {log.type === 'request' && (
                                 <button onClick={() => replay(log)} className="text-gray-400 hover:text-white" title="Replay">
                                     <Play size={14} />
                                 </button>
                             )}
                         </div>
                     </div>
                 ))
             )}
         </div>
      </div>
    </div>
  );
};
