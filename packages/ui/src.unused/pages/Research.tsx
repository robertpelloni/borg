import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export const Research = () => {
    const [topic, setTopic] = useState('');
    const [status, setStatus] = useState<string>('');
    const [logs, setLogs] = useState<string[]>([]);
    const [isResearching, setIsResearching] = useState(false);

    useEffect(() => {
        socket.on('traffic_log', (log: any) => {
            // Filter logs related to research agent if possible, or just show all for now
            // Ideally we check if it's from the research session
            if (isResearching) {
                setLogs(prev => [`[${log.type}] ${log.tool || 'Agent'}: ${JSON.stringify(log.result || log.args)}`, ...prev]);
            }
        });

        socket.on('research_update', (data: any) => {
             setLogs(prev => [`[Update] ${data.message}`, ...prev]);
             if (data.status === 'completed') {
                 setIsResearching(false);
                 setStatus('Research Completed.');
             }
        });

        return () => { socket.off('traffic_log'); socket.off('research_update'); };
    }, [isResearching]);

    const startResearch = async () => {
        if (!topic) return;
        setIsResearching(true);
        setStatus('Starting Deep Research...');
        setLogs([]);
        try {
            const res = await axios.post('/api/research', { topic });
            setStatus(`Research Session Started: ${res.data.sessionId}`);
        } catch (e: any) {
            setStatus(`Error: ${e.response?.data?.error || e.message}`);
            setIsResearching(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Deep Research Agent</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <div className="flex gap-4">
                    <input
                        type="text"
                        className="flex-1 border p-3 rounded text-lg"
                        placeholder="Enter a complex topic (e.g. 'Impact of AI on Bobcoin economics')"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={isResearching}
                    />
                    <button
                        onClick={startResearch}
                        disabled={isResearching}
                        className={`px-6 py-3 rounded text-white font-bold ${isResearching ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isResearching ? 'Researching...' : 'Start Research'}
                    </button>
                </div>
                <div className="mt-4 text-gray-600 font-mono">
                    Status: {status}
                </div>
            </div>

            <div className="bg-gray-900 text-green-400 p-6 rounded-lg shadow font-mono h-[500px] overflow-y-auto">
                <h3 className="text-gray-500 mb-2 border-b border-gray-700 pb-2">Live Activity Log</h3>
                {logs.length === 0 && <div className="text-gray-600">Waiting for activity...</div>}
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 break-words whitespace-pre-wrap">
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
};
