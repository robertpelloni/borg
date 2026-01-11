import { z } from "zod";

export const RunAgentRequestSchema = z.object({
  task: z.string().min(1),
  policyId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const RunAgentResponseSchema = z.object({
  success: z.boolean(),
  result: z.any(),
  error: z.string().optional(),
});
