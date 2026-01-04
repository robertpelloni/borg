import React, { useEffect, useState } from 'react';
import axios from 'axios';

export const Memory = () => {
    const [stats, setStats] = useState<any>(null);
    const [recentMemories, setRecentMemories] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    useEffect(() => {
        refresh();
    }, []);

    const refresh = async () => {
        try {
            const statsRes = await axios.post('/api/inspector/replay', { tool: 'memory_stats', args: {} });
            setStats(statsRes.data.result);

            const recentRes = await axios.post('/api/inspector/replay', { tool: 'recall_recent', args: { limit: 5 } });
            setRecentMemories(recentRes.data.result);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSearch = async () => {
        try {
            const res = await axios.post('/api/inspector/replay', { tool: 'search_memory', args: { query: searchQuery } });
            setSearchResults(res.data.result);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Long-Term Memory</h1>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <div className="text-gray-500 text-sm">Total Entries</div>
                    <div className="text-2xl font-bold">{stats?.totalEntries || 0}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <div className="text-gray-500 text-sm">Database Size</div>
                    <div className="text-2xl font-bold">{stats ? (stats.dbSize / 1024).toFixed(2) : 0} KB</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <div className="text-gray-500 text-sm">Last Update</div>
                    <div className="text-sm font-mono mt-1">{stats?.lastEntry ? new Date(stats.lastEntry).toLocaleString() : 'Never'}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Search */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Semantic Search</h2>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            className="flex-1 border p-2 rounded"
                            placeholder="Search memories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button
                            onClick={handleSearch}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                            Search
                        </button>
                    </div>

                    <div className="space-y-4">
                        {searchResults.map((mem, i) => (
                            <div key={i} className="border-b pb-2">
                                <p className="text-sm text-gray-800">{mem.content}</p>
                                <div className="flex gap-2 mt-1">
                                    {mem.metadata?.tags?.map((tag: string, j: number) => (
                                        <span key={j} className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {searchResults.length === 0 && <div className="text-gray-400 text-sm">No results found.</div>}
                    </div>
                </div>

                {/* Recent */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Recent Memories</h2>
                        <button onClick={refresh} className="text-sm text-blue-600 hover:underline">Refresh</button>
                    </div>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {recentMemories.slice().reverse().map((mem, i) => (
                            <div key={i} className="bg-gray-50 p-3 rounded">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{new Date(mem.timestamp).toLocaleString()}</span>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{mem.content}</p>
                                <div className="flex gap-2 mt-2">
                                    {mem.tags?.map((tag: string, j: number) => (
                                        <span key={j} className="text-xs bg-white border px-2 py-0.5 rounded text-gray-500">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
