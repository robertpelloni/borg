import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const API_BASE = process.env.AIOS_API_URL || 'http://localhost:3001';

interface LspServer {
    id: string;
    name: string;
    status: 'stopped' | 'starting' | 'running' | 'error';
    projectRoot?: string;
}

interface LspStatus {
    totalConfigs: number;
    availableCount: number;
    runningCount: number;
    servers: LspServer[];
}

export const LspView: React.FC = () => {
    const [status, setStatus] = useState<LspStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/lsp/status`);
                const data = await res.json();
                setStatus(data);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch LSP status');
                setLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'running': return 'green';
            case 'starting': return 'yellow';
            case 'error': return 'red';
            default: return 'gray';
        }
    };

    const getStatusIcon = (s: string) => {
        switch (s) {
            case 'running': return '●';
            case 'starting': return '◐';
            case 'error': return '✗';
            default: return '○';
        }
    };

    if (loading) {
        return <Box><Text color="yellow">Loading LSP status...</Text></Box>;
    }

    if (error) {
        return <Box><Text color="red">Error: {error}</Text></Box>;
    }

    if (!status) {
        return <Box><Text dimColor>No LSP data available</Text></Box>;
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="cyan">Language Server Protocol (LSP)</Text>
            </Box>

            <Box gap={2} marginBottom={1}>
                <Box>
                    <Text>Configs: </Text>
                    <Text bold>{status.totalConfigs}</Text>
                </Box>
                <Box>
                    <Text>Available: </Text>
                    <Text bold color="green">{status.availableCount}</Text>
                </Box>
                <Box>
                    <Text>Running: </Text>
                    <Text bold color="cyan">{status.runningCount}</Text>
                </Box>
            </Box>

            {status.servers.length > 0 && (
                <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
                    <Box marginBottom={1}>
                        <Box width={8}><Text bold>Status</Text></Box>
                        <Box width={25}><Text bold>Server</Text></Box>
                        <Box><Text bold>Project</Text></Box>
                    </Box>

                    {status.servers.map((server) => (
                        <Box key={server.id}>
                            <Box width={8}>
                                <Text color={getStatusColor(server.status)}>
                                    {getStatusIcon(server.status)} {server.status}
                                </Text>
                            </Box>
                            <Box width={25}>
                                <Text>{server.name}</Text>
                            </Box>
                            <Box>
                                <Text dimColor>{server.projectRoot || '-'}</Text>
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            {status.servers.length === 0 && (
                <Box padding={1} borderStyle="single" borderColor="gray">
                    <Text dimColor>No LSP servers currently running</Text>
                </Box>
            )}

            <Box marginTop={1}>
                <Text dimColor>
                    [a] Auto-load for project • [s] Stop all • [r] Refresh
                </Text>
            </Box>
        </Box>
    );
};
