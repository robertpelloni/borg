import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

export const Economy = () => {
    const [balance, setBalance] = useState<any>(null);
    const [nodeStatus, setNodeStatus] = useState<any>(null);
    const [activityLog, setActivityLog] = useState<any[]>([]);

    useEffect(() => {
        // Fetch initial state via tools (simulated via API for now, or just wait for socket)
        // Ideally we have a REST endpoint for economy state, but we can use the tool execution pattern

        socket.on('mcp_updated', () => {}); // Listen for general updates

        // Listen for transaction logs from server (if we emitted them globally)
        // For now, let's poll via tool execution replay
        const poll = setInterval(async () => {
            try {
                const balRes = await axios.post('/api/inspector/replay', { tool: 'get_balance', args: {} });
                setBalance(balRes.data.result);

                const nodeRes = await axios.post('/api/inspector/replay', { tool: 'node_status', args: {} });
                setNodeStatus(nodeRes.data.result);
            } catch (e) {}
        }, 2000);

        return () => clearInterval(poll);
    }, []);

    const toggleNode = async (type: 'tor' | 'torrent', active: boolean) => {
        const tool = type === 'tor' ? 'toggle_tor' : 'toggle_torrent';
        await axios.post('/api/inspector/replay', { tool, args: { active } });
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Bobcoin Economy</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Wallet Section */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 text-purple-600">Wallet</h2>
                    {balance ? (
                        <div>
                            <div className="text-4xl font-bold mb-2">{balance.balance.toFixed(4)} <span className="text-sm text-gray-500">BOB</span></div>
                            <div className="text-xs text-gray-400 font-mono bg-gray-100 p-2 rounded">{balance.address}</div>
                        </div>
                    ) : (
                        <div>Loading Wallet...</div>
                    )}
                </div>

                {/* Infrastructure Section */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 text-blue-600">Arcade Node Infrastructure</h2>
                    {nodeStatus ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span>Tor Node</span>
                                <button
                                    onClick={() => toggleNode('tor', !nodeStatus.tor)}
                                    className={`px-3 py-1 rounded text-sm ${nodeStatus.tor ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                                >
                                    {nodeStatus.tor ? 'Active' : 'Inactive'}
                                </button>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>MegaTorrent Seeder</span>
                                <button
                                    onClick={() => toggleNode('torrent', !nodeStatus.torrent)}
                                    className={`px-3 py-1 rounded text-sm ${nodeStatus.torrent ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                                >
                                    {nodeStatus.torrent ? 'Active' : 'Inactive'}
                                </button>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="text-sm text-gray-500">Uptime: {nodeStatus.uptime}s</div>
                                <div className="text-sm text-gray-500">Storage Allocated: {nodeStatus.storage} GB</div>
                            </div>
                        </div>
                    ) : (
                        <div>Loading Infrastructure...</div>
                    )}
                </div>
            </div>

            <div className="mt-8 bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Mining Activity Log</h2>
                <div className="text-sm text-gray-500 italic">
                    (Use `super-ai mine` CLI command to generate activity)
                </div>
            </div>
        </div>
    );
};
