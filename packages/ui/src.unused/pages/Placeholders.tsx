export function Billing() {
    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-6 text-purple-400">Billing & Subscriptions</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Providers */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-4">AI Providers</h3>
                    <ul className="space-y-4">
                        {[
                            { name: 'OpenAI', url: 'https://platform.openai.com/account/billing', type: 'API Key' },
                            { name: 'Anthropic', url: 'https://console.anthropic.com/settings/plans', type: 'API Key' },
                            { name: 'Google AI Studio', url: 'https://aistudio.google.com/', type: 'API Key' },
                            { name: 'Azure OpenAI', url: 'https://portal.azure.com/', type: 'Azure' },
                            { name: 'OpenRouter', url: 'https://openrouter.ai/keys', type: 'API Key' },
                        ].map(p => (
                            <li key={p.name} className="flex justify-between items-center bg-gray-700/50 p-3 rounded">
                                <div>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-xs text-gray-400">{p.type}</div>
                                </div>
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm hover:underline">Manage</a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Subscriptions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-xl font-bold mb-4">Memberships</h3>
                    <ul className="space-y-4">
                        {[
                            { name: 'ChatGPT Plus', url: 'https://chat.openai.com/#pricing' },
                            { name: 'Claude Pro', url: 'https://claude.ai/settings/billing' },
                            { name: 'GitHub Copilot', url: 'https://github.com/settings/copilot' },
                        ].map(s => (
                            <li key={s.name} className="flex justify-between items-center bg-gray-700/50 p-3 rounded">
                                <span className="font-bold">{s.name}</span>
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-green-400 text-sm hover:underline">Manage Subscription</a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export function Cloud() {
    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-6 text-cyan-400">Cloud Environments</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { name: 'GitHub Copilot Cloud', url: 'https://github.com/features/copilot' },
                    { name: 'Claude Cloud', url: 'https://claude.ai' },
                    { name: 'OpenAI Platform', url: 'https://platform.openai.com' },
                    { name: 'Google Vertex AI', url: 'https://cloud.google.com/vertex-ai' },
                ].map(c => (
                    <a key={c.name} href={c.url} target="_blank" rel="noopener noreferrer" className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:bg-gray-750 transition">
                        <div className="font-bold text-lg mb-2">{c.name}</div>
                        <div className="text-xs text-gray-500">External Link</div>
                    </a>
                ))}
            </div>
        </div>
    );
}

export function Jules() {
    return (
        <div className="h-full flex flex-col">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                 <h2 className="text-xl font-bold">Jules App</h2>
                 <span className="text-xs text-gray-500">submodules/jules-app</span>
            </div>
            <div className="flex-1 bg-black flex items-center justify-center">
                 <p className="text-gray-500">Jules App integration placeholder. (Requires running Next.js server)</p>
            </div>
        </div>
    );
}
