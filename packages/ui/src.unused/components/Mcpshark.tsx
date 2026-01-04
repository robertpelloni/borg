import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface TrafficLog {
    id: string;
    timestamp: number;
    source: string;
    destination: string;
    type: 'request' | 'response' | 'notification';
    method?: string;
    payload: any;
}

export function Mcpshark({ logs }: { logs: TrafficLog[] }) {
    const [filter, setFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);

    const filteredLogs = logs.filter(log =>
        log.method?.includes(filter) ||
        log.source.includes(filter) ||
        log.destination.includes(filter)
    );

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col h-96">
            <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-blue-400">Mcpshark Inspector</h2>
                    <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded-full">{logs.length} packets</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1.5 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Filter..."
                        className="bg-gray-900 border border-gray-600 rounded pl-8 pr-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Log List */}
                <div className="w-1/2 overflow-y-auto border-r border-gray-700">
                    <table className="w-full text-xs font-mono">
                        <thead className="bg-gray-800 text-gray-400 sticky top-0">
                            <tr>
                                <th className="p-2 text-left">Time</th>
                                <th className="p-2 text-left">Source &rarr; Dest</th>
                                <th className="p-2 text-left">Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr
                                    key={log.id}
                                    className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${selectedLog?.id === log.id ? 'bg-blue-900/30' : ''}`}
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <td className="p-2 text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td className="p-2">
                                        <span className="text-green-400">{log.source}</span>
                                        <span className="text-gray-500 mx-1">→</span>
                                        <span className="text-yellow-400">{log.destination}</span>
                                    </td>
                                    <td className="p-2 text-blue-300 truncate max-w-[100px]">{log.method}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Detail View */}
                <div className="w-1/2 p-4 overflow-y-auto bg-gray-950">
                    {selectedLog ? (
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm border-b border-gray-800 pb-2">
                                <span className="font-bold text-white">{selectedLog.type.toUpperCase()}</span>
                                <span className="text-gray-500">{selectedLog.id}</span>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Payload</label>
                                <pre className="bg-gray-900 p-2 rounded text-green-400 text-xs overflow-auto">
                                    {JSON.stringify(selectedLog.payload, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-600 italic">
                            Select a packet to inspect
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
