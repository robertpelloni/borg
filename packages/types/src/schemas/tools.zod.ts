import { z } from "zod";

// Define tool-specific status enum
export const ToolStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
export type ToolStatus = z.infer<typeof ToolStatusEnum>;

// Tool schema
export const ToolSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable(),
  toolSchema: z.object({
    type: z.literal("object"),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional(),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  mcp_server_uuid: z.string().uuid(),
});

export type Tool = z.infer<typeof ToolSchema>;

// Get tools by MCP server UUID
export const GetToolsByMcpServerUuidRequestSchema = z.object({
  mcpServerUuid: z.string().uuid(),
});

export const GetToolsByMcpServerUuidResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ToolSchema),
  message: z.string().optional(),
});

// Save tools to database
export const CreateToolRequestSchema = z.object({
  mcpServerUuid: z.string().uuid(),
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      inputSchema: z.object({
        type: z.literal("object").optional(),
        properties: z.record(z.any()).optional(),
        required: z.array(z.string()).optional(),
      }),
    }),
  ),
});

export const CreateToolResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  message: z.string().optional(),
  error: z.string().optional(),
});

// Export types
export type GetToolsByMcpServerUuidRequest = z.infer<
  typeof GetToolsByMcpServerUuidRequestSchema
>;
export type GetToolsByMcpServerUuidResponse = z.infer<
  typeof GetToolsByMcpServerUuidResponseSchema
>;

export type CreateToolRequest = z.infer<typeof CreateToolRequestSchema>;
export type CreateToolResponse = z.infer<typeof CreateToolResponseSchema>;

// Repository-specific schemas
export const ToolCreateInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  toolSchema: z.object({
    type: z.literal("object"),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional(),
  }),
  mcp_server_uuid: z.string(),
});

export const ToolUpsertInputSchema = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      inputSchema: z
        .object({
          properties: z.record(z.any()).optional(),
          required: z.array(z.string()).optional(),
        })
        .optional(),
    }),
  ),
  mcpServerUuid: z.string(),
});

export type ToolCreateInput = z.infer<typeof ToolCreateInputSchema>;
export type ToolUpsertInput = z.infer<typeof ToolUpsertInputSchema>;

// Database-specific schemas (raw database results with Date objects)
export const DatabaseToolSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable(),
  toolSchema: z.object({
    type: z.literal("object"),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional(),
  }),
  created_at: z.date(),
  updated_at: z.date(),
  mcp_server_uuid: z.string(),
});

export type DatabaseTool = z.infer<typeof DatabaseToolSchema>;

export const PatternFilterOptionsSchema = z.object({
  caseSensitive: z.boolean().optional(),
  matchDescription: z.boolean().optional(),
  matchServer: z.boolean().optional(),
});

export const PatternFilterRequestSchema = z.object({
  mcpServerUuid: z.string().uuid().optional(),
  patterns: z.union([z.string(), z.array(z.string())]),
  options: PatternFilterOptionsSchema.optional(),
});

export const PatternFilterCombinedRequestSchema = z.object({
  mcpServerUuid: z.string().uuid().optional(),
  include: z.union([z.string(), z.array(z.string())]).optional(),
  exclude: z.union([z.string(), z.array(z.string())]).optional(),
  servers: z.union([z.string(), z.array(z.string())]).optional(),
});

export const SmartFilterRequestSchema = z.object({
  mcpServerUuid: z.string().uuid().optional(),
  query: z.string(),
  options: PatternFilterOptionsSchema.optional(),
});

export const FilterResultSchema = z.object({
  items: z.array(ToolSchema),
  matched: z.number(),
  total: z.number(),
  patterns: z.array(z.string()),
});

export const PatternFilterResponseSchema = z.object({
  success: z.boolean(),
  data: FilterResultSchema.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type PatternFilterOptions = z.infer<typeof PatternFilterOptionsSchema>;
export type PatternFilterRequest = z.infer<typeof PatternFilterRequestSchema>;
export type PatternFilterCombinedRequest = z.infer<
  typeof PatternFilterCombinedRequestSchema
>;
export type SmartFilterRequest = z.infer<typeof SmartFilterRequestSchema>;
export type FilterResult = z.infer<typeof FilterResultSchema>;
export type PatternFilterResponse = z.infer<typeof PatternFilterResponseSchema>;
