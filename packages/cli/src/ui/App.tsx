
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
// import { trpc } from '../utils/trpc'; // We'll need a node-compatible trpc client here

export const App = ({ view }: { view: string }) => {
    const [status, setStatus] = useState<string>('Loading...');

    useEffect(() => {
        // Mock fetching status for now until we setup node-client trpc
        setTimeout(() => {
            setStatus('Online (Mock)');
        }, 1000);
    }, []);

    if (view === 'status') {
        return (
            <Box borderStyle="round" borderColor="cyan" flexDirection="column" padding={1}>
                <Text bold color="green">AIOS Orchestrator Status</Text>
                <Text>State: {status}</Text>
            </Box>
        );
    }

    return <Text>Unknown view</Text>;
};
