import React, { useState, useEffect } from 'react';
import { SystemStatus } from '../components/SystemStatus';
import { Activity, Shield, Cpu, Terminal, Globe, CheckCircle, AlertTriangle } from 'lucide-react';

export const Settings = () => {
    const [doctor, setDoctor] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/doctor')
            .then(res => res.json())
            .then(setDoctor);
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Settings & Health</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Model Configuration */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center">
                        <Cpu className="mr-2" /> Model Configuration
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Active Provider</label>
                            <select className="w-full bg-gray-900 border border-gray-700 rounded p-2">
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="ollama">Ollama (Local)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Model Name</label>
                            <input type="text" className="w-full bg-gray-900 border border-gray-700 rounded p-2" defaultValue="gpt-4-turbo" />
                        </div>
                        <button className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-500 w-full">Save Configuration</button>
                    </div>
                </div>

                {/* System Doctor */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                    <h2 className="text-xl font-bold mb-4 flex items-center">
                        <Activity className="mr-2" /> System Doctor
                    </h2>
                    <div className="space-y-3">
                        {doctor.map((check: any) => (
                            <div key={check.name} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                                <div className="flex items-center">
                                    <span className="capitalize font-mono mr-2">{check.name}</span>
                                    {check.version && <span className="text-xs text-gray-500">({check.version})</span>}
                                </div>
                                <div>
                                    {check.status === 'ok' ? (
                                        <CheckCircle className="text-green-500" size={18} />
                                    ) : (
                                        <AlertTriangle className="text-red-500" size={18} />
                                    )}
                                </div>
                            </div>
                        ))}
                        {doctor.length === 0 && <div className="text-gray-500 text-center">Loading checks...</div>}
                    </div>
                    <div className="mt-4 text-center">
                        <button onClick={() => window.location.reload()} className="text-sm text-blue-400 hover:underline">Refresh Checks</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
