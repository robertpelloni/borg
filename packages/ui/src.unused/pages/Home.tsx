import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Activity, Zap, Box, Brain, MessageSquare, FileText, ShoppingBag, Terminal, Monitor } from 'lucide-react';
import { Mcpshark } from '../components/Mcpshark';

// Reusing socket from props or context would be better, but for now let's keep it simple.
// Actually, multiple socket connections might be bad.
// I will assume props are passed.

export function Home() {
  const [state, setState] = useState({
    agents: [],
    skills: [],
    hooks: [],
    prompts: [],
    context: [],
    mcpServers: {}
  });
  const [clients, setClients] = useState<any[]>([]);
  const [code, setCode] = useState("return 'Hello World';");
  const [codeOutput, setCodeOutput] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<any[]>([]);

  // We need a socket here.
  const [socket] = useState(() => io('http://localhost:3000'));

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to Core');
    });

    fetch('http://localhost:3000/api/clients')
        .then(res => res.json())
        .then(data => setClients(data.clients || []))
        .catch(console.error);

    socket.on('state', (data) => setState(data));
    socket.on('agents_updated', (agents) => setState(prev => ({ ...prev, agents })));
    socket.on('skills_updated', (skills) => setState(prev => ({ ...prev, skills })));
    socket.on('hooks_updated', (hooks) => setState(prev => ({ ...prev, hooks })));
    socket.on('prompts_updated', (prompts) => setState(prev => ({ ...prev, prompts })));
    socket.on('context_updated', (context) => setState(prev => ({ ...prev, context })));

    socket.on('hook_log', (event) => {
        setLogs(prev => [event, ...prev]);
    });

    socket.on('traffic_log', (log) => {
        setTrafficLogs(prev => [log, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const runCode = async () => {
      try {
          const res = await fetch('http://localhost:3000/api/code/run', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ code })
          });
          const data = await res.json();
          setCodeOutput(JSON.stringify(data.result, null, 2));
      } catch (e: any) {
          setCodeOutput("Error: " + e.message);
      }
  };

  const configureClient = async (clientName: string) => {
      try {
          const res = await fetch('http://localhost:3000/api/clients/configure', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ clientName })
          });
          const data = await res.json();
          alert(`Configured ${clientName}: ${JSON.stringify(data)}`);
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  return (
    <div className="p-8">
      {/* Code Mode & Clients */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
           <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
               <div className="flex items-center gap-2 mb-4 text-green-400">
                <Terminal size={24} />
                <h2 className="text-xl font-semibold">Code Mode Playground</h2>
              </div>
              <textarea
                className="w-full bg-black/50 text-xs font-mono p-2 rounded h-24 mb-2 text-white border border-gray-600 focus:border-blue-500 outline-none"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="flex justify-between items-center">
                  <button onClick={runCode} className="bg-green-600 hover:bg-green-500 px-4 py-1 rounded text-sm font-bold">Run Code</button>
                  <span className="text-xs text-gray-500">Isolate-VM (128MB)</span>
              </div>
              {codeOutput && (
                  <pre className="mt-2 p-2 bg-black text-green-400 text-xs rounded overflow-auto">{codeOutput}</pre>
              )}
           </div>

           <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
               <div className="flex items-center gap-2 mb-4 text-blue-400">
                <Monitor size={24} />
                <h2 className="text-xl font-semibold">Client Integrations</h2>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {clients.length === 0 && <p className="text-gray-500 italic">Scanning...</p>}
                {clients.map((client: any) => (
                    <div key={client.name} className="bg-gray-700/50 p-3 rounded flex justify-between items-center">
                        <div>
                            <div className="font-bold text-sm">{client.name}</div>
                            <div className="text-xs text-gray-400">{client.exists ? 'Config Found' : 'Config Missing'}</div>
                        </div>
                        <button
                            onClick={() => configureClient(client.name)}
                            className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs"
                        >
                            Inject Config
                        </button>
                    </div>
                ))}
              </div>
           </div>
      </div>

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

      {/* Mcpshark */}
      <div className="mt-8">
          <Mcpshark logs={trafficLogs} />
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
