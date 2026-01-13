import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const API_BASE = process.env.AIOS_API_URL || 'http://localhost:3001';

interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    latency?: number;
}

interface HealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
    uptime: number;
    timestamp: number;
}

export const HealthView: React.FC = () => {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/health`);
                const data = await res.json();
                setHealth(data);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch health');
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'healthy': return 'green';
            case 'degraded': return 'yellow';
            case 'unhealthy': return 'red';
            default: return 'gray';
        }
    };

    const getStatusIcon = (s: string) => {
        switch (s) {
            case 'healthy': return '✓';
            case 'degraded': return '!';
            case 'unhealthy': return '✗';
            default: return '?';
        }
    };

    const formatUptime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    if (loading) {
        return <Box><Text color="yellow">Loading health status...</Text></Box>;
    }

    if (error) {
        return <Box><Text color="red">Error: {error}</Text></Box>;
    }

    if (!health) {
        return <Box><Text dimColor>No health data available</Text></Box>;
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1} gap={2}>
                <Text bold color="cyan">System Health</Text>
                <Text color={getStatusColor(health.overall)}>
                    {getStatusIcon(health.overall)} {health.overall.toUpperCase()}
                </Text>
            </Box>

            <Box gap={3} marginBottom={1}>
                <Box>
                    <Text>Uptime: </Text>
                    <Text bold color="green">{formatUptime(health.uptime)}</Text>
                </Box>
                <Box>
                    <Text>Last check: </Text>
                    <Text dimColor>{new Date(health.timestamp).toLocaleTimeString()}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
                <Box marginBottom={1}>
                    <Box width={10}><Text bold>Status</Text></Box>
                    <Box width={20}><Text bold>Component</Text></Box>
                    <Box width={10}><Text bold>Latency</Text></Box>
                    <Box><Text bold>Message</Text></Box>
                </Box>

                {health.checks.map((check) => (
                    <Box key={check.name}>
                        <Box width={10}>
                            <Text color={getStatusColor(check.status)}>
                                {getStatusIcon(check.status)} {check.status}
                            </Text>
                        </Box>
                        <Box width={20}>
                            <Text>{check.name}</Text>
                        </Box>
                        <Box width={10}>
                            <Text dimColor>
                                {check.latency ? `${check.latency}ms` : '-'}
                            </Text>
                        </Box>
                        <Box>
                            <Text dimColor>{check.message || '-'}</Text>
                        </Box>
                    </Box>
                ))}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>
                    [r] Refresh • [d] Run diagnostics
                </Text>
            </Box>
        </Box>
    );
};
