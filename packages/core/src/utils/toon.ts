export function toToon(json: any): string {
    // 1. Minify
    // 2. Remove nulls
    // 3. Compact keys (heuristic)

    // For now, a simple minification with a "toon" header
    const clean = JSON.stringify(json, (key, value) => {
        if (value === null) return undefined;
        return value;
    });

    return `TOON:v1:${clean}`;
}

export const FormatTranslatorTool = {
    name: "translate_format",
    description: "Translate JSON to TOON format.",
    inputSchema: {
        type: "object",
        properties: {
            data: {
                type: ["object", "string"],
                description: "JSON object or string"
            }
        },
        required: ["data"]
    }
};
