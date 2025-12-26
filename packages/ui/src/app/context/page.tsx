'use client';

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function Context() {
  const [context, setContext] = useState<any[]>([]);

  useEffect(() => {
    socket.on('state', (data: any) => {
      if (data.context) setContext(data.context);
    });
    socket.on('context_updated', (data: any) => setContext(data));
    return () => {
      socket.off('state');
      socket.off('context_updated');
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Context Management</h1>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="grid grid-cols-12 bg-gray-750 p-4 border-b border-gray-700 font-medium text-gray-400">
          <div className="col-span-8">File</div>
          <div className="col-span-4 text-right">Size</div>
        </div>

        {context.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No context files found. Add files to <code>context/</code>.
          </div>
        ) : (
          context.map((f, i) => (
            <div key={i} className="grid grid-cols-12 p-4 border-b border-gray-700 last:border-0 hover:bg-gray-750 items-center">
              <div className="col-span-8 flex items-center gap-3">
                <FileText size={18} className="text-blue-400" />
                <span className="font-mono text-gray-300">{f.name}</span>
              </div>
              <div className="col-span-4 text-right text-sm text-gray-500">
                {f.content.length} bytes
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
