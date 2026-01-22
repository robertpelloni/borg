"use client";

import { useState } from "react";
import { trpc } from "../utils/trpc";

export function DirectorChat() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<{ role: 'user' | 'agent', content: string }[]>([
        { role: 'agent', content: 'Hello! I am the Director. What task shall I perform?' }
    ]);

    const chatMutation = trpc.director.chat.useMutation({
        onSuccess: (data) => {
            setMessages(prev => [...prev, { role: 'agent', content: data }]);
        },
        onError: (error) => {
            setMessages(prev => [...prev, { role: 'agent', content: `Error: ${error.message}` }]);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || chatMutation.isPending) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput("");
        chatMutation.mutate({ message: userMsg });
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-xl w-full">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                💬 Director Chat
            </h2>

            <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4 h-64 overflow-y-auto mb-4 flex flex-col gap-3">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 text-zinc-200'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {chatMutation.isPending && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-800 text-zinc-400 rounded-lg p-3 text-sm animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Tell the Director what to do..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded p-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={chatMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                    Send
                </button>
            </form>
        </div>
    );
}
