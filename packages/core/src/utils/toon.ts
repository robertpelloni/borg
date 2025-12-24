// The "Toon" format: Compacted JSON for tools.
// Strategy: Remove redundant keys, use array format for params where schema is implied, 
// or just minify and strip descriptions if "compact" is strict.
// For now, let's implement a "Smart Compact" that keeps essential signatures but strips verbose docs.

export function toToon(toolJson: any): string {
  if (!toolJson) return '';

  // If it's an array of tools
  if (Array.isArray(toolJson)) {
    return toolJson.map(t => compactSingleTool(t)).join('\n');
  }
  
  return compactSingleTool(toolJson);
}

function compactSingleTool(tool: any): string {
  // Example Input: { name: "readFile", description: "...", inputSchema: { ... } }
  // Example Output: readFile(path: string): string
  
  const name = tool.name;
  if (!name) return JSON.stringify(tool); // Fallback

  const props = tool.inputSchema?.properties || {};
  const required = new Set(tool.inputSchema?.required || []);

  const params = Object.entries(props).map(([key, schema]: [string, any]) => {
    const type = schema.type || 'any';
    const isReq = required.has(key) ? '' : '?';
    return `${key}${isReq}: ${type}`;
  });

  return `def ${name}(${params.join(', ')})`;
}

export const FormatTranslatorTool = {
    name: "translate_format",
    description: "Translate JSON tool definitions into compact TOON format to save tokens.",
    inputSchema: {
        type: "object",
        properties: {
            data: {
                type: "string",
                description: "The JSON string to translate (array or object)"
            }
        },
        required: ["data"]
    }
};
