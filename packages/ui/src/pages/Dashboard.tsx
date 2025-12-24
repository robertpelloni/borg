import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Wifi, CheckCircle, XCircle, Play, Square, Globe } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export const Dashboard = () => {
  const [stats, setStats] = useState({
    agents: 0,
    skills: 0,
    mcpServers: 0,
    runningServers: 0
  });

  const [metaMcpConnected, setMetaMcpConnected] = useState<boolean | null>(null);

  useEffect(() => {
    socket.on('state', (data: any) => {
      const running = data.mcpServers.filter((s: any) => s.status === 'running').length;
      setStats({
        agents: data.agents.length,
        skills: data.skills.length,
        mcpServers: data.mcpServers.length,
        runningServers: running
      });
    });

    socket.on('mcp_updated', (servers: any[]) => {
       const running = servers.filter(s => s.status === 'running').length;
       setStats(prev => ({ ...prev, mcpServers: servers.length, runningServers: running }));
    });

    // Check MetaMCP Status via our proxy API
    // We can't easily check SSE connection status from here without an explicit API endpoint on Core
    // But we can infer it if 'search_tools' is available? Not reliably.
    // Let's assume for this mock that we check a new health endpoint in next step,
    // or just leave it as 'Unknown' for now.
    // Actually, I'll add a check later.

    return () => {
      socket.off('state');
      socket.off('mcp_updated');
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-bold mb-2">System Overview</h1>
        <p className="text-gray-400">Real-time monitoring of your Super AI Plugin ecosystem.</p>
      </header>

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm mb-1">Core Service</div>
            <div className="text-xl font-bold flex items-center gap-2 text-green-400">
              <CheckCircle size={20} /> Online
            </div>
          </div>
          <Activity className="text-gray-600" size={32} />
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm mb-1">MetaMCP Backend</div>
            <div className="text-xl font-bold flex items-center gap-2 text-gray-400">
               <Globe size={20} /> {metaMcpConnected === true ? <span className="text-green-400">Connected</span> : 'Unknown'}
            </div>
          </div>
          <ServerIcon className="text-gray-600" size={32} />
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm mb-1">Local Servers</div>
            <div className="text-xl font-bold flex items-center gap-2 text-blue-400">
              <Cpu size={20} /> {stats.runningServers} / {stats.mcpServers}
            </div>
          </div>
          <ServerIcon className="text-gray-600" size={32} />
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex items-center justify-between">
          <div>
            <div className="text-gray-400 text-sm mb-1">Intelligence</div>
            <div className="text-xl font-bold flex items-center gap-2 text-purple-400">
              <BotIcon size={20} /> {stats.agents} Agents
            </div>
          </div>
          <BotIcon className="text-gray-600" size={32} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
             <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors">
                <div className="font-bold">Add API Key</div>
                <div className="text-xs text-gray-400">Configure new tools</div>
             </button>
             <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors">
                <div className="font-bold">Install to Clients</div>
                <div className="text-xs text-gray-400">Auto-configure Claude/VSCode</div>
             </button>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2">System Resources</h2>
          {/* Mock Chart */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Memory Usage</span>
                <span className="text-gray-200">1.2 GB / 16 GB</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[15%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">CPU Load</span>
                <span className="text-gray-200">12%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 w-[12%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ServerIcon = ({size, className}: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
)

const BotIcon = ({size, className}: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
)
