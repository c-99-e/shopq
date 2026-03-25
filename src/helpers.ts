import { resolveConfig, createClient, ConfigError, GraphQLError } from "./graphql";
import type { GraphQLClient } from "./graphql";
import { formatError } from "./output";
import { existsSync } from "fs";

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

/**
 * Read a file as text, with user-friendly error handling.
 * Returns the file contents or writes an error to stderr and sets exit code 1.
 * Returns null on failure so callers can return early.
 */
export async function readFileText(path: string): Promise<string | null> {
  if (!existsSync(path)) {
    formatError(`File not found: ${path}`);
    process.exitCode = 1;
    return null;
  }
  try {
    return await Bun.file(path).text();
  } catch (err) {
    formatError(`Failed to read file: ${path}`);
    process.exitCode = 1;
    return null;
  }
}

/**
 * Read a file and parse it as JSON, with user-friendly error handling.
 * Returns the parsed value or null on failure.
 */
export async function readFileJson(path: string): Promise<any | null> {
  const text = await readFileText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    formatError(`Invalid JSON in file: ${path}`);
    process.exitCode = 1;
    return null;
  }
}
