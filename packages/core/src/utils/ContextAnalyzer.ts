
export interface ContextBreakdown {
    system: number;
    user: number;
    tool_output: number;
    memory: number;
    code: number;
    total: number;
    segments: {
        type: 'system' | 'user' | 'tool' | 'memory' | 'code';
        preview: string;
        length: number;
        percentage: number;
    }[];
}

export class ContextAnalyzer {
    static analyze(messages: any[]): ContextBreakdown {
        let system = 0;
        let user = 0;
        let tool_output = 0;
        let memory = 0;
        let code = 0;
        const segments: ContextBreakdown['segments'] = [];

        for (const msg of messages) {
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
            const length = content.length;
            let type: 'system' | 'user' | 'tool' | 'memory' | 'code' = 'user';

            if (msg.role === 'system') {
                type = 'system';
                system += length;
            } else if (msg.role === 'tool') {
                type = 'tool';
                tool_output += length;
            } else if (msg.role === 'user') {
                // Heuristic detection
                if (content.includes('[Memory]')) {
                    type = 'memory';
                    memory += length;
                } else if (content.includes('```')) {
                    // Rough estimate for code blocks
                    type = 'code';
                    code += length;
                } else {
                    type = 'user';
                    user += length;
                }
            }

            segments.push({
                type: type as any,
                preview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                length,
                percentage: 0 // Calculated later
            });
        }

        const total = system + user + tool_output + memory + code;

        // Calculate percentages
        segments.forEach(s => {
            s.percentage = total > 0 ? (s.length / total) * 100 : 0;
        });

        return {
            system,
            user,
            tool_output,
            memory,
            code,
            total,
            segments
        };
    }
}
