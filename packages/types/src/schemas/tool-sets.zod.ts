import { z } from "zod";

export const ToolSetSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tools: z.array(z.string()),
});

export const GetToolSetsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ToolSetSchema),
});

export const DeleteToolSetRequestSchema = z.object({
  uuid: z.string(),
});

export const DeleteToolSetResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type ToolSet = z.infer<typeof ToolSetSchema>;
