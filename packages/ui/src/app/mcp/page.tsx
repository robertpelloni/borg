'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Terminal, Activity, Wrench, Server } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrafficInspector } from '@/components/mcp/TrafficInspector';
import { ToolExplorer } from '@/components/mcp/ToolExplorer';

const API_BASE = '/api'; // Now proxied

export default function McpDashboard() {
  const [servers, setServers] = useState<any[]>([]);

  const fetchServers = async () => {
    try {
      const res = await fetch(`${API_BASE}/state`);
      const data = await res.json();
      setServers(data.mcpServers);
    } catch (e) {
      console.error("Failed to fetch state", e);
    }
  };

  useEffect(() => {
    fetchServers();
    const interval = setInterval(fetchServers, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleServer = async (name: string, status: string) => {
    const endpoint = status === 'running' ? 'stop' : 'start';
    await fetch(`${API_BASE}/mcp/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    fetchServers();
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">MCP Control Plane</h1>
        <div className="flex gap-2">
            <div className="bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
                <span className="text-gray-400 text-sm mr-2">Active Servers:</span>
                <span className="font-bold text-green-400">{servers.filter(s => s.status === 'running').length}</span>
            </div>
        </div>
      </div>

      <Tabs defaultValue="servers" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-gray-800/50 p-1">
          <TabsTrigger value="servers" className="data-[state=active]:bg-gray-700">
            <Server className="mr-2 h-4 w-4" /> Servers
          </TabsTrigger>
          <TabsTrigger value="tools" className="data-[state=active]:bg-gray-700">
            <Wrench className="mr-2 h-4 w-4" /> Tool Explorer
          </TabsTrigger>
          <TabsTrigger value="traffic" className="data-[state=active]:bg-gray-700">
            <Activity className="mr-2 h-4 w-4" /> Traffic Inspector
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servers">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
            {servers.map((server) => (
              <div key={server.name} className="flex items-center justify-between p-6 border-b border-gray-700 last:border-0 hover:bg-gray-750 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${server.status === 'running' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    <Terminal size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        {server.name}
                        {server.status === 'running' && <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full border border-green-800">Active</span>}
                    </h3>
                    <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${server.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                      {server.status.toUpperCase()}
                      {server.tools > 0 && <span className="text-gray-500">• {server.tools} tools</span>}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleServer(server.name, server.status)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                    server.status === 'running'
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                      : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'
                  }`}
                >
                  {server.status === 'running' ? <><Square size={18} fill="currentColor" /> Stop</> : <><Play size={18} fill="currentColor" /> Start</>}
                </button>
              </div>
            ))}
            {servers.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                    No servers configured.
                </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tools">
          <ToolExplorer />
        </TabsContent>

        <TabsContent value="traffic">
          <TrafficInspector />
        </TabsContent>
      </Tabs>
    </div>
  );
}
