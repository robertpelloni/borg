import { z } from "zod";

export const ServerHealthStatusEnum = z.enum([
  "HEALTHY",
  "UNHEALTHY",
  "UNKNOWN",
  "CHECKING",
]);
export type ServerHealthStatus = z.infer<typeof ServerHealthStatusEnum>;

export const ServerHealthInfoSchema = z.object({
  serverUuid: z.string().uuid(),
  serverName: z.string(),
  status: ServerHealthStatusEnum,
  lastChecked: z.string().datetime().nullable(),
  lastHealthy: z.string().datetime().nullable(),
  responseTimeMs: z.number().nullable(),
  errorMessage: z.string().nullable(),
  consecutiveFailures: z.number(),
  toolCount: z.number().nullable(),
});
export type ServerHealthInfo = z.infer<typeof ServerHealthInfoSchema>;

export const HealthCheckResultSchema = z.object({
  serverUuid: z.string().uuid(),
  success: z.boolean(),
  responseTimeMs: z.number(),
  toolCount: z.number().optional(),
  errorMessage: z.string().optional(),
  checkedAt: z.string().datetime(),
});
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

export const CheckServerHealthRequestSchema = z.object({
  serverUuids: z.array(z.string().uuid()).optional(),
});
export type CheckServerHealthRequest = z.infer<
  typeof CheckServerHealthRequestSchema
>;

export const CheckServerHealthResponseSchema = z.object({
  success: z.literal(true).or(z.literal(false)),
  data: z.array(HealthCheckResultSchema).optional(),
  message: z.string(),
});
export type CheckServerHealthResponse = z.infer<
  typeof CheckServerHealthResponseSchema
>;

export const GetServerHealthRequestSchema = z.object({
  serverUuids: z.array(z.string().uuid()).optional(),
});
export type GetServerHealthRequest = z.infer<
  typeof GetServerHealthRequestSchema
>;

export const GetServerHealthResponseSchema = z.object({
  success: z.literal(true).or(z.literal(false)),
  data: z.array(ServerHealthInfoSchema).optional(),
  message: z.string(),
});
export type GetServerHealthResponse = z.infer<
  typeof GetServerHealthResponseSchema
>;

export const HealthCheckConfigSchema = z.object({
  intervalMs: z.number().min(5000).default(60000),
  timeoutMs: z.number().min(1000).default(10000),
  unhealthyThreshold: z.number().min(1).default(3),
  enabled: z.boolean().default(true),
});
export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;

export const HealthSummarySchema = z.object({
  totalServers: z.number(),
  healthyCount: z.number(),
  unhealthyCount: z.number(),
  unknownCount: z.number(),
  checkingCount: z.number(),
  lastFullCheckAt: z.string().datetime().nullable(),
});
export type HealthSummary = z.infer<typeof HealthSummarySchema>;

export const GetHealthSummaryResponseSchema = z.object({
  success: z.literal(true).or(z.literal(false)),
  data: HealthSummarySchema.optional(),
  message: z.string(),
});
export type GetHealthSummaryResponse = z.infer<
  typeof GetHealthSummaryResponseSchema
>;
