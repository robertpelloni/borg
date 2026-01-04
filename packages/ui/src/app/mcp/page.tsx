'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Terminal } from 'lucide-react';

const API_BASE = 'http://localhost:3002';

export default function McpServers() {
  const [servers, setServers] = useState<any[]>([]);

  const fetchServers = async () => {
    const res = await fetch(`${API_BASE}/api/state`);
    const data = await res.json();
    setServers(data.mcpServers);
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleServer = async (name: string, status: string) => {
    const endpoint = status === 'running' ? 'stop' : 'start';
    await fetch(`${API_BASE}/api/mcp/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    fetchServers();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">MCP Servers</h1>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        {servers.map((server) => (
          <div key={server.name} className="flex items-center justify-between p-6 border-b border-gray-700 last:border-0 hover:bg-gray-750">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${server.status === 'running' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                <Terminal size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{server.name}</h3>
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${server.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                  {server.status.toUpperCase()}
                </div>
              </div>
            </div>

            <button
              onClick={() => toggleServer(server.name, server.status)}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                server.status === 'running'
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
            >
              {server.status === 'running' ? <><Square size={18} fill="currentColor" /> Stop</> : <><Play size={18} fill="currentColor" /> Start</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
