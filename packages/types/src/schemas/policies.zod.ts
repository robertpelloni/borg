import { z } from "zod";

export const PolicyRuleSchema = z.object({
  allow: z.array(z.string()),
  deny: z.array(z.string()).optional(),
});

export const PolicySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  rules: PolicyRuleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  rules: PolicyRuleSchema,
});

export const UpdatePolicySchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  rules: PolicyRuleSchema.optional(),
});

export const DeletePolicySchema = z.object({
  uuid: z.string(),
});
