import { z } from "zod";

/**
 * Configuration Validation Schemas
 *
 * This module provides comprehensive JSON Schema validation for all MetaMCP
 * configuration files, including:
 * - Claude Desktop config (claude_desktop_config.json)
 * - MCP server definitions
 * - MetaMCP internal configuration
 *
 * @module config-schemas.zod
 * @version 3.2.9
 */

// ============================================================================
// Claude Desktop Config Schema (claude_desktop_config.json)
// ============================================================================

/**
 * Environment variables schema - validates key-value pairs
 */
export const EnvVarsSchema = z
  .record(z.string(), z.string())
  .describe("Environment variables passed to the MCP server process");

/**
 * HTTP headers schema - validates key-value pairs
 */
export const HttpHeadersSchema = z
  .record(z.string(), z.string())
  .describe("HTTP headers for SSE/Streamable HTTP connections");

/**
 * STDIO MCP Server definition in Claude Desktop config
 */
export const ClaudeStdioServerSchema = z
  .object({
    command: z.string().min(1, "Command is required for STDIO servers"),
    args: z.array(z.string()).optional().default([]),
    env: EnvVarsSchema.optional().default({}),
  })
  .strict();

/**
 * SSE/HTTP MCP Server definition in Claude Desktop config
 */
export const ClaudeSseServerSchema = z
  .object({
    url: z.string().url("URL must be a valid URL"),
    headers: HttpHeadersSchema.optional().default({}),
  })
  .strict();

/**
 * Combined server definition - can be either STDIO or SSE type
 */
export const ClaudeServerDefinitionSchema = z
  .union([ClaudeStdioServerSchema, ClaudeSseServerSchema])
  .describe(
    "MCP server definition - either STDIO (command-based) or SSE (URL-based)",
  );

/**
 * Full Claude Desktop config file schema
 */
export const ClaudeDesktopConfigSchema = z
  .object({
    mcpServers: z
      .record(
        z
          .string()
          .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Server name must only contain letters, numbers, underscores, and hyphens",
          ),
        ClaudeServerDefinitionSchema,
      )
      .describe("Map of server names to their configurations"),
  })
  .describe("Claude Desktop configuration file (claude_desktop_config.json)");

export type ClaudeDesktopConfig = z.infer<typeof ClaudeDesktopConfigSchema>;
export type ClaudeServerDefinition = z.infer<
  typeof ClaudeServerDefinitionSchema
>;
export type ClaudeStdioServer = z.infer<typeof ClaudeStdioServerSchema>;
export type ClaudeSseServer = z.infer<typeof ClaudeSseServerSchema>;

// ============================================================================
// MetaMCP Config Key Validation
// ============================================================================

/**
 * Boolean config value schema
 */
export const BooleanConfigValueSchema = z
  .enum(["true", "false"])
  .transform((val) => val === "true");

/**
 * Positive integer config value schema
 */
export const PositiveIntConfigValueSchema = z
  .string()
  .refine((val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0;
  }, "Value must be a positive integer")
  .transform((val) => parseInt(val, 10));

/**
 * Timeout value schema (1s to 1h in milliseconds)
 */
export const TimeoutConfigValueSchema = z
  .string()
  .refine((val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num >= 1000 && num <= 3600000;
  }, "Timeout must be between 1000ms (1s) and 3600000ms (1h)")
  .transform((val) => parseInt(val, 10));

/**
 * Max attempts value schema (1-10)
 */
export const MaxAttemptsConfigValueSchema = z
  .string()
  .refine((val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num >= 1 && num <= 10;
  }, "Max attempts must be between 1 and 10")
  .transform((val) => parseInt(val, 10));

/**
 * Session lifetime value schema (1 minute to 1 year in milliseconds)
 */
export const SessionLifetimeConfigValueSchema = z
  .string()
  .refine((val) => {
    const num = parseInt(val, 10);
    // 1 minute (60000ms) to 1 year (31536000000ms)
    return !isNaN(num) && num >= 60000 && num <= 31536000000;
  }, "Session lifetime must be between 60000ms (1 min) and 31536000000ms (1 year)")
  .transform((val) => parseInt(val, 10));

/**
 * Config key to validation schema mapping
 */
export const ConfigKeyValidators = {
  DISABLE_SIGNUP: BooleanConfigValueSchema,
  DISABLE_SSO_SIGNUP: BooleanConfigValueSchema,
  DISABLE_BASIC_AUTH: BooleanConfigValueSchema,
  MCP_RESET_TIMEOUT_ON_PROGRESS: BooleanConfigValueSchema,
  MCP_TIMEOUT: TimeoutConfigValueSchema,
  MCP_MAX_TOTAL_TIMEOUT: TimeoutConfigValueSchema,
  MCP_MAX_ATTEMPTS: MaxAttemptsConfigValueSchema,
  SESSION_LIFETIME: SessionLifetimeConfigValueSchema,
} as const;

export type ConfigKeyValidator = keyof typeof ConfigKeyValidators;

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Single validation error
 */
export const ValidationErrorSchema = z.object({
  path: z.string().describe("JSON path to the error location"),
  message: z.string().describe("Human-readable error message"),
  code: z.string().optional().describe("Error code for programmatic handling"),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

/**
 * Validation result for config imports
 */
export const ConfigValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(ValidationErrorSchema).optional(),
  warnings: z.array(ValidationErrorSchema).optional(),
  data: z.unknown().optional().describe("Parsed and validated data if valid"),
});

export type ConfigValidationResult = z.infer<
  typeof ConfigValidationResultSchema
>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate a Claude Desktop config JSON string
 */
export function validateClaudeDesktopConfig(
  configJson: string,
): ConfigValidationResult {
  try {
    const parsed = JSON.parse(configJson);
    const result = ClaudeDesktopConfigSchema.safeParse(parsed);

    if (result.success) {
      return {
        valid: true,
        data: result.data,
      };
    }

    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message:
            error instanceof SyntaxError
              ? `Invalid JSON: ${error.message}`
              : "Failed to parse configuration",
          code: "PARSE_ERROR",
        },
      ],
    };
  }
}

/**
 * Validate a single config key-value pair
 */
export function validateConfigValue(
  key: string,
  value: string,
): ConfigValidationResult {
  const validator = ConfigKeyValidators[key as ConfigKeyValidator];

  if (!validator) {
    return {
      valid: false,
      errors: [
        {
          path: key,
          message: `Unknown configuration key: ${key}`,
          code: "UNKNOWN_KEY",
        },
      ],
    };
  }

  const result = validator.safeParse(value);

  if (result.success) {
    return {
      valid: true,
      data: result.data,
    };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: key,
      message: issue.message,
      code: issue.code,
    })),
  };
}

/**
 * Check if a server definition is STDIO type
 */
export function isStdioServer(
  server: ClaudeServerDefinition,
): server is ClaudeStdioServer {
  return "command" in server;
}

/**
 * Check if a server definition is SSE type
 */
export function isSseServer(
  server: ClaudeServerDefinition,
): server is ClaudeSseServer {
  return "url" in server;
}

/**
 * Validate a partial config object (for API updates)
 */
export function validatePartialConfig(
  configs: Record<string, string>,
): ConfigValidationResult {
  const errors: ValidationError[] = [];
  const validated: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(configs)) {
    const result = validateConfigValue(key, value);
    if (!result.valid && result.errors) {
      errors.push(...result.errors);
    } else if (result.valid) {
      validated[key] = result.data;
    }
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, data: validated };
}
