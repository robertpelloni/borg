import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, Zap, Box, Brain, MessageSquare, FileText, ShoppingBag } from 'lucide-react';

const socket = io('http://localhost:3000');

function App() {
  const [state, setState] = useState({ 
    agents: [], 
    skills: [], 
    hooks: [],
    prompts: [],
    context: [] 
  });
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to Core');
    });

    socket.on('state', (data) => setState(data));
    socket.on('agents_updated', (agents) => setState(prev => ({ ...prev, agents })));
    socket.on('skills_updated', (skills) => setState(prev => ({ ...prev, skills })));
    socket.on('hooks_updated', (hooks) => setState(prev => ({ ...prev, hooks })));
    socket.on('prompts_updated', (prompts) => setState(prev => ({ ...prev, prompts })));
    socket.on('context_updated', (context) => setState(prev => ({ ...prev, context })));
    
    socket.on('hook_log', (event) => {
        setLogs(prev => [event, ...prev]);
    });

    return () => {
      socket.off('connect');
      socket.off('state');
      socket.off('agents_updated');
      socket.off('skills_updated');
      socket.off('hooks_updated');
      socket.off('prompts_updated');
      socket.off('context_updated');
      socket.off('hook_log');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Super AI Plugin Console
        </h1>
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${socket.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-400">{socket.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Agents Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4 text-blue-400">
            <Brain size={24} />
            <h2 className="text-xl font-semibold">Agents</h2>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.agents.length === 0 && <p className="text-gray-500 italic">No agents loaded.</p>}
            {state.agents.map((agent: any) => (
              <div key={agent.name} className="bg-gray-700/50 p-3 rounded">
                <div className="font-bold">{agent.name}</div>
                <div className="text-xs text-gray-400">{agent.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4 text-purple-400">
            <Box size={24} />
            <h2 className="text-xl font-semibold">Skills</h2>
          </div>
           <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.skills.length === 0 && <p className="text-gray-500 italic">No skills loaded.</p>}
            {state.skills.map((skill: any) => (
              <div key={skill.name} className="bg-gray-700/50 p-3 rounded flex justify-between">
                <span>{skill.name}</span>
                <span className="text-xs bg-gray-600 px-2 py-1 rounded">MD</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hooks Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4 text-yellow-400">
            <Zap size={24} />
            <h2 className="text-xl font-semibold">Hooks</h2>
          </div>
           <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.hooks.length === 0 && <p className="text-gray-500 italic">No hooks configured.</p>}
            {state.hooks.map((hook: any, i) => (
              <div key={i} className="bg-gray-700/50 p-3 rounded text-sm">
                <span className="text-yellow-200 font-mono">{hook.event}</span>
                <div className="text-xs text-gray-400 truncate">{hook.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Prompts Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4 text-pink-400">
            <MessageSquare size={24} />
            <h2 className="text-xl font-semibold">Prompts Library</h2>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {state.prompts.length === 0 && <p className="text-gray-500 italic">No prompts.</p>}
            {state.prompts.map((p: any) => (
              <div key={p.name} className="bg-gray-700/50 p-2 rounded text-sm font-mono">
                {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Context Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4 text-orange-400">
            <FileText size={24} />
            <h2 className="text-xl font-semibold">Active Context</h2>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
             {state.context.length === 0 && <p className="text-gray-500 italic">No context files.</p>}
             {state.context.map((c: any) => (
              <div key={c.name} className="bg-gray-700/50 p-2 rounded text-sm font-mono">
                {c.name}
              </div>
            ))}
          </div>
        </div>

        {/* Marketplace Stub */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 opacity-50">
          <div className="flex items-center gap-2 mb-4 text-green-400">
            <ShoppingBag size={24} />
            <h2 className="text-xl font-semibold">Marketplace</h2>
          </div>
          <p className="text-gray-500 text-sm">
              Explore Skills, Agents, and MCP Servers.
              <br/>
              (Coming Soon)
          </p>
        </div>
      </div>

      {/* Activity Log */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
         <div className="flex items-center gap-2 mb-4 text-green-400">
            <Activity size={24} />
            <h2 className="text-xl font-semibold">Activity Log</h2>
          </div>
          <div className="bg-black/50 rounded p-4 font-mono text-xs h-64 overflow-y-auto">
             {logs.length === 0 && <p className="text-gray-600">Waiting for events...</p>}
             {logs.map((log, i) => (
                 <div key={i} className="mb-2 border-b border-gray-800 pb-1">
                    <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-blue-400 mx-2">{log.type}</span>
                    <span className="text-gray-300">{JSON.stringify(log.payload)}</span>
                 </div>
             ))}
          </div>
      </div>
    </div>
  )
}

export default App
