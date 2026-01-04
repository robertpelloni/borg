import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export function Handoffs() {
    const [handoffs, setHandoffs] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/handoff')
            .then(res => res.json())
            .then(data => setHandoffs(data.handoffs));
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Session Handoffs</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {handoffs.map(h => (
                    <div key={h.id} className="bg-gray-800 p-4 rounded border border-gray-700">
                        <div className="font-bold text-lg mb-1">{h.description}</div>
                        <div className="text-sm text-gray-400 mb-2">{new Date(h.timestamp).toLocaleString()}</div>
                        <div className="text-xs font-mono bg-gray-900 p-2 rounded overflow-auto h-24">
                            {JSON.stringify(h.context, null, 2)}
                        </div>
                        <div className="mt-3 flex justify-end">
                             <button className="bg-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-500">Resume</button>
                        </div>
                    </div>
                ))}
                {handoffs.length === 0 && (
                    <div className="text-gray-500 col-span-3 text-center py-10">
                        No handoffs found. Use the <code>save_handoff</code> tool to create one.
                    </div>
                )}
            </div>
        </div>
    );
}
