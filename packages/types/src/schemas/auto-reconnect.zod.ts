import { z } from "zod";

export const ReconnectionStatusEnum = z.enum([
  "IDLE",
  "PENDING",
  "RECONNECTING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "MAX_RETRIES_EXCEEDED",
]);
export type ReconnectionStatus = z.infer<typeof ReconnectionStatusEnum>;

export const ReconnectionStateSchema = z.object({
  serverUuid: z.string().uuid(),
  serverName: z.string(),
  status: ReconnectionStatusEnum,
  currentAttempt: z.number(),
  maxAttempts: z.number(),
  nextRetryAt: z.string().datetime().nullable(),
  lastAttemptAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  totalAttempts: z.number(),
  successfulReconnections: z.number(),
});
export type ReconnectionState = z.infer<typeof ReconnectionStateSchema>;

export const ReconnectionResultSchema = z.object({
  serverUuid: z.string().uuid(),
  success: z.boolean(),
  attempt: z.number(),
  error: z.string().optional(),
  reconnectedAt: z.string().datetime().optional(),
});
export type ReconnectionResult = z.infer<typeof ReconnectionResultSchema>;

export const ReconnectionConfigSchema = z.object({
  maxAttempts: z.number().min(1).max(20).default(5),
  baseDelayMs: z.number().min(100).max(30000).default(1000),
  maxDelayMs: z.number().min(1000).max(300000).default(60000),
  jitterFactor: z.number().min(0).max(1).default(0.2),
  autoReconnectOnCrash: z.boolean().default(true),
  autoReconnectOnHealthFailure: z.boolean().default(true),
});
export type ReconnectionConfig = z.infer<typeof ReconnectionConfigSchema>;

export const TriggerReconnectionRequestSchema = z.object({
  serverUuid: z.string().uuid(),
});
export type TriggerReconnectionRequest = z.infer<
  typeof TriggerReconnectionRequestSchema
>;

export const TriggerReconnectionResponseSchema = z.object({
  success: z.boolean(),
  data: ReconnectionResultSchema.optional(),
  message: z.string(),
});
export type TriggerReconnectionResponse = z.infer<
  typeof TriggerReconnectionResponseSchema
>;

export const CancelReconnectionRequestSchema = z.object({
  serverUuid: z.string().uuid().optional(),
  cancelAll: z.boolean().optional(),
});
export type CancelReconnectionRequest = z.infer<
  typeof CancelReconnectionRequestSchema
>;

export const CancelReconnectionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type CancelReconnectionResponse = z.infer<
  typeof CancelReconnectionResponseSchema
>;

export const GetReconnectionStateRequestSchema = z.object({
  serverUuids: z.array(z.string().uuid()).optional(),
});
export type GetReconnectionStateRequest = z.infer<
  typeof GetReconnectionStateRequestSchema
>;

export const GetReconnectionStateResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ReconnectionStateSchema).optional(),
  message: z.string(),
});
export type GetReconnectionStateResponse = z.infer<
  typeof GetReconnectionStateResponseSchema
>;

export const ReconnectionSummarySchema = z.object({
  totalTracked: z.number(),
  pending: z.number(),
  reconnecting: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  cancelled: z.number(),
  maxRetriesExceeded: z.number(),
});
export type ReconnectionSummary = z.infer<typeof ReconnectionSummarySchema>;

export const GetReconnectionSummaryResponseSchema = z.object({
  success: z.boolean(),
  data: ReconnectionSummarySchema.optional(),
  message: z.string(),
});
export type GetReconnectionSummaryResponse = z.infer<
  typeof GetReconnectionSummaryResponseSchema
>;

export const ConfigureReconnectionRequestSchema = z.object({
  config: ReconnectionConfigSchema.partial(),
});
export type ConfigureReconnectionRequest = z.infer<
  typeof ConfigureReconnectionRequestSchema
>;

export const ConfigureReconnectionResponseSchema = z.object({
  success: z.boolean(),
  data: ReconnectionConfigSchema.optional(),
  message: z.string(),
});
export type ConfigureReconnectionResponse = z.infer<
  typeof ConfigureReconnectionResponseSchema
>;

export const SetReconnectionEnabledRequestSchema = z.object({
  enabled: z.boolean(),
});
export type SetReconnectionEnabledRequest = z.infer<
  typeof SetReconnectionEnabledRequestSchema
>;

export const SetReconnectionEnabledResponseSchema = z.object({
  success: z.boolean(),
  enabled: z.boolean(),
  message: z.string(),
});
export type SetReconnectionEnabledResponse = z.infer<
  typeof SetReconnectionEnabledResponseSchema
>;
