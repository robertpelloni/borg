import React, { useState, useEffect } from 'react';
import { Bot, Play, Square, Terminal } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
const API_BASE = 'http://localhost:3000';

export const Agents = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [task, setTask] = useState('');

  useEffect(() => {
    socket.on('state', (data: any) => {
        if (data.agents) setAgents(data.agents);
    });
    socket.on('agents_updated', (data: any) => setAgents(data));
    return () => {
        socket.off('state');
        socket.off('agents_updated');
    };
  }, []);

  const runAgent = async (agentName: string) => {
      setRunning(agentName);
      setOutput(prev => prev + `\n[System] Starting agent ${agentName}...\n`);
      try {
          const res = await fetch(`${API_BASE}/api/agents/run`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentName, task: task || "Introduce yourself" })
          });
          const data = await res.json();
          setOutput(prev => prev + `[Agent] ${JSON.stringify(data.result, null, 2)}\n`);
      } catch (e: any) {
          setOutput(prev => prev + `[Error] ${e.message}\n`);
      } finally {
          setRunning(null);
      }
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <h1 className="text-3xl font-bold mb-8">Agents & Active Intelligence</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Agent List */}
        <div className="col-span-1 bg-gray-800 rounded-xl border border-gray-700 overflow-y-auto">
            <div className="p-4 border-b border-gray-700 font-bold text-gray-400">Available Agents</div>
            {agents.length === 0 ? (
                <div className="p-4 text-gray-500 text-sm">No agents found. Add to <code>agents/</code>.</div>
            ) : (
                agents.map((agent) => (
                    <div key={agent.name} className="p-4 border-b border-gray-700 hover:bg-gray-750 cursor-pointer">
                        <div className="flex items-center gap-3 mb-2">
                            <Bot className="text-purple-400" />
                            <span className="font-bold">{agent.name}</span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">{agent.description}</p>
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => runAgent(agent.name)}
                                disabled={!!running}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1"
                            >
                                <Play size={12} /> Run
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Execution Interface */}
        <div className="col-span-2 bg-gray-900 rounded-xl border border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl flex justify-between items-center">
                <span className="font-bold text-gray-300 flex items-center gap-2">
                    <Terminal size={18} /> Console Output
                </span>
                {running && <span className="text-xs text-green-400 animate-pulse">● Running {running}...</span>}
            </div>

            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm text-gray-300 whitespace-pre-wrap">
                {output || <span className="text-gray-600">Select an agent to run...</span>}
            </div>

            <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-b-xl">
                <label className="block text-xs text-gray-400 mb-1">Task / Input</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={task}
                        onChange={e => setTask(e.target.value)}
                        placeholder="e.g. Analyze the project structure..."
                        className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                        onKeyDown={e => e.key === 'Enter' && !running && agents.length > 0 && runAgent(agents[0].name)}
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
