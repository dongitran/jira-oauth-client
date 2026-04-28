import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { jiraTokensSchema } from "./schemas.js";
import type { JiraTokens } from "./types.js";

const DEFAULT_STORE_PATH = join(homedir(), ".jira-oauth", "tokens.json");

export function resolveStorePath(tokenStorePath?: string): string {
  return tokenStorePath ?? DEFAULT_STORE_PATH;
}

export function readTokens(tokenStorePath?: string): JiraTokens | null {
  const storePath = resolveStorePath(tokenStorePath);

  if (!existsSync(storePath)) {
    return null;
  }

  try {
    const raw = readFileSync(storePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = jiraTokensSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: JiraTokens, tokenStorePath?: string): Promise<void> {
  const storePath = resolveStorePath(tokenStorePath);
  const dir = dirname(storePath);
  const shouldCreateDir = !existsSync(dir);

  if (shouldCreateDir) {
    mkdirSync(dir, { mode: 0o700, recursive: true });
    await chmod(dir, 0o700);
  }

  const validatedTokens = jiraTokensSchema.parse(tokens);
  const temporaryPath = `${storePath}.${process.pid.toString()}.${Date.now().toString()}.tmp`;

  try {
    writeFileSync(temporaryPath, JSON.stringify(validatedTokens, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    renameSync(temporaryPath, storePath);
    await chmod(storePath, 0o600);
  } catch (error) {
    if (existsSync(temporaryPath)) {
      rmSync(temporaryPath, { force: true });
    }

    throw error;
  }
}
