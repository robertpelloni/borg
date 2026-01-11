import { z } from "zod";

export const MetaMcpLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  serverName: z.string().optional(), // Now derived from tool_name prefix or similar
  level: z.enum(["error", "info", "warn"]),
  message: z.string(), // Summary: "Called tool X"
  error: z.string().nullable().optional(),

  // New structured fields
  toolName: z.string().optional(),
  arguments: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
  durationMs: z.string().optional(),
  sessionId: z.string().optional(),
  parentCallUuid: z.string().nullable().optional(),
});

export const GetLogsRequestSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
  sessionId: z.string().optional(),
});

export const GetLogsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(MetaMcpLogEntrySchema),
  totalCount: z.number(),
});

export const ClearLogsResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type MetaMcpLogEntry = z.infer<typeof MetaMcpLogEntrySchema>;
export type GetLogsRequest = z.infer<typeof GetLogsRequestSchema>;
export type GetLogsResponse = z.infer<typeof GetLogsResponseSchema>;
export type ClearLogsResponse = z.infer<typeof ClearLogsResponseSchema>;
