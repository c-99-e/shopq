import { resolveConfig, createClient, ConfigError, GraphQLError } from "./graphql";
import type { GraphQLClient } from "./graphql";
import { formatError } from "./output";

/**
 * Create a GraphQL client from parsed flags.
 * Centralizes resolveConfig + MISTY_PROTOCOL + createClient.
 */
export function getClient(flags: { store?: string }): GraphQLClient {
  const config = resolveConfig(flags.store);
  const protocol = process.env.MISTY_PROTOCOL === "http" ? "http" : "https";
  return createClient({ ...config, protocol });
}

/**
 * Shared error handler for command catch blocks.
 * Handles ConfigError and GraphQLError with stderr + exit code 1.
 * Rethrows anything else.
 */
export function handleCommandError(err: unknown): void {
  if (err instanceof ConfigError) {
    formatError(err.message);
    process.exitCode = 1;
    return;
  }
  if (err instanceof GraphQLError) {
    formatError(err.message);
    process.exitCode = 1;
    return;
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new Error(String(err));
}
