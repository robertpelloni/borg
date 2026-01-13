import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useStore, type ViewType } from './hooks/useStore.js';
import { DashboardView } from './views/Dashboard.js';
import { ChatView } from './views/Chat.js';
import { AgentsView } from './views/Agents.js';
import { ToolsView } from './views/Tools.js';
import { SessionsView } from './views/Sessions.js';
import { LspView } from './views/Lsp.js';
import { HealthView } from './views/Health.js';

const VERSION = '0.4.0';

const views: Array<{ key: string; id: ViewType; label: string }> = [
    { key: '1', id: 'dashboard', label: 'Dashboard' },
    { key: '2', id: 'chat', label: 'Chat' },
    { key: '3', id: 'agents', label: 'Agents' },
    { key: '4', id: 'tools', label: 'Tools' },
    { key: '5', id: 'sessions', label: 'Sessions' },
    { key: '6', id: 'lsp', label: 'LSP' },
    { key: '7', id: 'health', label: 'Health' },
];

export const App: React.FC = () => {
    const { currentView, setView } = useStore();
    const { exit } = useApp();

    useInput((input, key) => {
        if (key.escape) {
            exit();
            return;
        }
        
        const view = views.find(v => v.key === input);
        if (view) {
            setView(view.id);
        }
    });

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView />;
            case 'chat': return <ChatView />;
            case 'agents': return <AgentsView />;
            case 'tools': return <ToolsView />;
            case 'sessions': return <SessionsView />;
            case 'lsp': return <LspView />;
            case 'health': return <HealthView />;
        }
    };

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1} gap={1}>
                <Text bold color="cyan">AIOS</Text>
                <Text dimColor>v{VERSION}</Text>
                <Text> │ </Text>
                {views.map((view, i) => (
                    <React.Fragment key={view.id}>
                        <Text 
                            color={currentView === view.id ? 'green' : 'white'}
                            bold={currentView === view.id}
                        >
                            [{view.key}] {view.label}
                        </Text>
                        {i < views.length - 1 && <Text> </Text>}
                    </React.Fragment>
                ))}
            </Box>

            <Box flexGrow={1}>
                {renderView()}
            </Box>

            <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                <Text dimColor>
                    [1-4] Switch views • [ESC] Exit • [↑↓] Navigate • [Enter] Select
                </Text>
            </Box>
        </Box>
    );
};
