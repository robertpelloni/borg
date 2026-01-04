import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface SystemInfo {
    version: string;
    submodules: { path: string; version: string; status: string }[];
}

export const Dashboard = () => {
    const [system, setSystem] = useState<SystemInfo | null>(null);

    useEffect(() => {
        axios.get('/api/system').then(res => setSystem(res.data));
    }, []);

    if (!system) return <div>Loading...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Super AI Plugin Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-xl font-semibold mb-2">System Info</h2>
                    <p><strong>Version:</strong> {system.version}</p>
                </div>

                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-xl font-semibold mb-2">Submodules</h2>
                    <table className="w-full text-left">
                        <thead>
                            <tr>
                                <th className="border-b p-2">Path</th>
                                <th className="border-b p-2">Version</th>
                                <th className="border-b p-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {system.submodules.map((sub, i) => (
                                <tr key={i}>
                                    <td className="border-b p-2">{sub.path}</td>
                                    <td className="border-b p-2 text-sm font-mono">{sub.version.substring(0, 7)}</td>
                                    <td className="border-b p-2">{sub.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
