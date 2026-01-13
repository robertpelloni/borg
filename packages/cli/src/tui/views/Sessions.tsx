import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const API_BASE = process.env.AIOS_API_URL || 'http://localhost:3001';

interface Session {
    id: string;
    agentName: string;
    timestamp: number;
    isPublic?: boolean;
    shareToken?: string;
}

export const SessionsView: React.FC = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/sessions`);
                const data = await res.json();
                setSessions(data.sessions || []);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
                setLoading(false);
            }
        };

        fetchSessions();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <Box>
                <Text color="yellow">Loading sessions...</Text>
            </Box>
        );
    }

    if (error) {
        return (
            <Box>
                <Text color="red">Error: {error}</Text>
            </Box>
        );
    }

    if (sessions.length === 0) {
        return (
            <Box>
                <Text dimColor>No sessions found</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="cyan">Sessions ({sessions.length})</Text>
            </Box>

            <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
                <Box marginBottom={1}>
                    <Box width={20}><Text bold>ID</Text></Box>
                    <Box width={20}><Text bold>Agent</Text></Box>
                    <Box width={20}><Text bold>Date</Text></Box>
                    <Box width={10}><Text bold>Shared</Text></Box>
                </Box>

                {sessions.slice(0, 10).map((session, index) => (
                    <Box key={session.id} backgroundColor={index === selectedIndex ? 'blue' : undefined}>
                        <Box width={20}>
                            <Text color={index === selectedIndex ? 'white' : 'gray'}>
                                {session.id.slice(0, 16)}...
                            </Text>
                        </Box>
                        <Box width={20}>
                            <Text>{session.agentName}</Text>
                        </Box>
                        <Box width={20}>
                            <Text dimColor>
                                {new Date(session.timestamp).toLocaleDateString()}
                            </Text>
                        </Box>
                        <Box width={10}>
                            <Text color={session.isPublic ? 'green' : 'gray'}>
                                {session.isPublic ? '●' : '○'}
                            </Text>
                        </Box>
                    </Box>
                ))}
            </Box>

            <Box marginTop={1}>
                <Text dimColor>
                    [↑↓] Navigate • [s] Share • [d] Delete • [r] Refresh
                </Text>
            </Box>
        </Box>
    );
};
