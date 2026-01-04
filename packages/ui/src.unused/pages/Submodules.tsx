import React, { useState, useEffect } from 'react';
import { GitBranch, ExternalLink, RefreshCw } from 'lucide-react';

export const Submodules = () => {
    const [submodules, setSubmodules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSubmodules = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/submodules');
            const data = await res.json();
            setSubmodules(data.submodules || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmodules();
    }, []);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-blue-400">Ecosystem Submodules</h1>
                    <p className="text-gray-400 mt-2">Integrated repositories and references powering the Super AI Plugin.</p>
                </div>
                <button onClick={fetchSubmodules} className="text-gray-400 hover:text-white transition">
                    <RefreshCw size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {submodules.map((sub) => (
                    <div key={sub.name} className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-blue-500/50 transition">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                                <GitBranch size={20} />
                            </div>
                            <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white">
                                <ExternalLink size={16} />
                            </a>
                        </div>
                        <h3 className="text-lg font-bold mb-1 truncate" title={sub.name}>{sub.name}</h3>
                        <div className="text-xs text-gray-500 font-mono mb-4 truncate">{sub.path}</div>

                        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900 p-2 rounded">
                            <span className="font-semibold text-green-400">Synced</span>
                            <span className="ml-auto opacity-50">{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {submodules.length === 0 && !loading && (
                 <div className="text-center p-12 text-gray-500">
                     No submodules found in configuration.
                 </div>
            )}
        </div>
    );
};
