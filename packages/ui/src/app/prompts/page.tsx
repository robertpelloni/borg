'use client';

import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002');

export default function Prompts() {
  const [prompts, setPrompts] = useState<any[]>([]);

  useEffect(() => {
    socket.on('state', (data: any) => {
      if (data.prompts) setPrompts(data.prompts);
    });
    socket.on('prompts_updated', (data: any) => setPrompts(data));
    return () => {
      socket.off('state');
      socket.off('prompts_updated');
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Prompt Library</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {prompts.length === 0 ? (
          <div className="col-span-2 text-center p-8 bg-gray-800 rounded-xl border border-gray-700 text-gray-400">
            No prompts found. Add files to the <code>prompts/</code> directory.
          </div>
        ) : (
          prompts.map((p, i) => (
            <div key={i} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                    <MessageSquare size={20} />
                  </div>
                  <h3 className="font-bold text-lg">{p.name}</h3>
                </div>
              </div>
              <div className="bg-gray-900 p-3 rounded text-sm font-mono text-gray-400 h-32 overflow-y-auto whitespace-pre-wrap">
                {p.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
