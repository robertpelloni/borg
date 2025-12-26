'use client';

import { useState, useEffect } from 'react';
import { Activity, Cpu, CheckCircle, Globe, Terminal as TerminalIcon, Puzzle, Code, Monitor, LayoutDashboard, Bot, ShieldCheck, FolderTree } from 'lucide-react';
import { io } from 'socket.io-client';
import { IntegratedTerminal } from '@/components/IntegratedTerminal';
import Link from 'next/link';

const socket = io('http://localhost:3000');

const ServerIcon = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="6" y2="6" />
    <line x1="6" x2="6.01" y1="18" y2="18" />
  </svg>
);

const BotIcon = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    agents: 0,
    skills: 0,
    mcpServers: 0,
    runningServers: 0
  });

  const [metaMcpConnected, setMetaMcpConnected] = useState<boolean | null>(null);
  const [activeComponents, setActiveComponents] = useState({
    plugin: true,
    browserExtension: false,
    opencode: false,
    terminal: true
  });

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

    // Mock component status check
    // In a real app, these would be checked via API or socket events
    const checkComponents = async () => {
        // Example: Check if browser extension is connected via a specific socket event or API
        // setMetaMcpConnected(true); // Mock
    };
    checkComponents();

    return () => {
      socket.off('state');
      socket.off('mcp_updated');
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-bold mb-2">System Overview</h1>
        <p className="text-gray-400">Real-time monitoring of your Super AI Plugin ecosystem.</p>
      </header>

      {/* Component Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg border ${activeComponents.plugin ? 'bg-green-900/20 border-green-800' : 'bg-gray-800 border-gray-700'} flex items-center gap-3`}>
              <Puzzle className={activeComponents.plugin ? 'text-green-400' : 'text-gray-500'} />
              <div>
                  <div className="font-semibold">Plugin Mode</div>
                  <div className="text-xs text-gray-400">{activeComponents.plugin ? 'Active' : 'Inactive'}</div>
              </div>
          </div>
          <div className={`p-4 rounded-lg border ${activeComponents.browserExtension ? 'bg-green-900/20 border-green-800' : 'bg-gray-800 border-gray-700'} flex items-center gap-3`}>
              <Globe className={activeComponents.browserExtension ? 'text-green-400' : 'text-gray-500'} />
              <div>
                  <div className="font-semibold">Browser Ext</div>
                  <div className="text-xs text-gray-400">{activeComponents.browserExtension ? 'Connected' : 'Not Detected'}</div>
              </div>
          </div>
          <div className={`p-4 rounded-lg border ${activeComponents.opencode ? 'bg-green-900/20 border-green-800' : 'bg-gray-800 border-gray-700'} flex items-center gap-3`}>
              <Code className={activeComponents.opencode ? 'text-green-400' : 'text-gray-500'} />
              <div>
                  <div className="font-semibold">OpenCode</div>
                  <div className="text-xs text-gray-400">{activeComponents.opencode ? 'Linked' : 'Not Linked'}</div>
              </div>
          </div>
          <div className={`p-4 rounded-lg border ${activeComponents.terminal ? 'bg-green-900/20 border-green-800' : 'bg-gray-800 border-gray-700'} flex items-center gap-3`}>
              <TerminalIcon className={activeComponents.terminal ? 'text-green-400' : 'text-gray-500'} />
              <div>
                  <div className="font-semibold">Terminal</div>
                  <div className="text-xs text-gray-400">{activeComponents.terminal ? 'Ready' : 'Offline'}</div>
              </div>
          </div>
      </div>

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terminal Section */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                  <h2 className="font-semibold flex items-center gap-2">
                      <TerminalIcon size={18} /> System Terminal
                  </h2>
                  <div className="text-xs text-gray-500">Connected to Localhost</div>
              </div>
              <div className="flex-1 relative">
                  <IntegratedTerminal className="absolute inset-0" />
              </div>
          </div>

          {/* Quick Actions & Resources */}
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2">Jules Control Tower</h2>
            <div className="grid grid-cols-1 gap-4">
                <Link href="/jules" className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors flex items-center gap-3">
                    <div className="bg-indigo-500/20 p-2 rounded text-indigo-400"><LayoutDashboard size={18} /></div>
                    <div>
                        <div className="font-bold">Jules Dashboard</div>
                        <div className="text-xs text-gray-400">Manage sessions & tasks</div>
                    </div>
                </Link>
                <Link href="/jules" className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors flex items-center gap-3">
                    <div className="bg-pink-500/20 p-2 rounded text-pink-400"><Bot size={18} /></div>
                    <div>
                        <div className="font-bold">Autopilot</div>
                        <div className="text-xs text-gray-400">Configure autonomous agents</div>
                    </div>
                </Link>
                <Link href="/jules" className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors flex items-center gap-3">
                    <div className="bg-amber-500/20 p-2 rounded text-amber-400"><ShieldCheck size={18} /></div>
                    <div>
                        <div className="font-bold">Supervisor</div>
                        <div className="text-xs text-gray-400">Server-side monitoring</div>
                    </div>
                </Link>
            </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4">
                <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded text-blue-400"><Puzzle size={18} /></div>
                    <div>
                        <div className="font-bold">Add API Key</div>
                        <div className="text-xs text-gray-400">Configure new tools</div>
                    </div>
                </button>
                <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors flex items-center gap-3">
                    <div className="bg-purple-500/20 p-2 rounded text-purple-400"><Monitor size={18} /></div>
                    <div>
                        <div className="font-bold">Install to Clients</div>
                        <div className="text-xs text-gray-400">Auto-configure Claude/VSCode</div>
                    </div>
                </button>
                <Link href="/project" className="bg-gray-700 hover:bg-gray-600 p-3 rounded text-left transition-colors flex items-center gap-3">
                    <div className="bg-teal-500/20 p-2 rounded text-teal-400"><FolderTree size={18} /></div>
                    <div>
                        <div className="font-bold">Project Structure</div>
                        <div className="text-xs text-gray-400">Submodules & Layout</div>
                    </div>
                </Link>
            </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2">System Resources</h2>
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
    </div>
  );
}
