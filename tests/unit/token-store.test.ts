import { existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readTokens, writeTokens } from "../../src/token-store.js";
import { sampleTokens } from "../fixtures/tokens.fixture.js";

describe("token-store", () => {
  let storePath: string;

  beforeEach(() => {
    storePath = join(tmpdir(), `jira-oauth-test-${Date.now().toString()}.json`);
  });

  afterEach(() => {
    if (existsSync(storePath)) {
      rmSync(storePath);
    }
  });

  describe("readTokens", () => {
    it("returns null when file does not exist", () => {
      expect(readTokens(storePath)).toBeNull();
    });

    it("returns null when file contains malformed JSON", () => {
      writeFileSync(storePath, "not-json-content", "utf8");
      expect(readTokens(storePath)).toBeNull();
    });

    it("returns null when file content does not match the token shape", () => {
      writeFileSync(storePath, JSON.stringify({ accessToken: "sample-access-token" }), "utf8");
      expect(readTokens(storePath)).toBeNull();
    });

    it("returns parsed tokens when file exists and is valid", async () => {
      await writeTokens(sampleTokens, storePath);
      const result = readTokens(storePath);
      expect(result).toEqual(sampleTokens);
    });
  });

  describe("writeTokens", () => {
    it("creates the file with correct content", async () => {
      await writeTokens(sampleTokens, storePath);
      const result = readTokens(storePath);
      expect(result).toEqual(sampleTokens);
    });

    it("creates parent directory if it does not exist", async () => {
      const nestedDir = join(tmpdir(), `jira-test-${Date.now().toString()}`);
      const nestedPath = join(nestedDir, "tokens.json");
      await writeTokens(sampleTokens, nestedPath);
      expect(existsSync(nestedPath)).toBe(true);
      rmSync(nestedDir, { recursive: true, force: true });
    });

    it("creates parent directory with owner-only permissions", async () => {
      const nestedDir = join(tmpdir(), `jira-dir-test-${Date.now().toString()}`);
      const nestedPath = join(nestedDir, "tokens.json");
      await writeTokens(sampleTokens, nestedPath);
      const permissions = statSync(nestedDir).mode & 0o777;
      expect(permissions).toBe(0o700);
      rmSync(nestedDir, { recursive: true, force: true });
    });

    it("sets file permissions to 0o600", async () => {
      await writeTokens(sampleTokens, storePath);
      const stats = statSync(storePath);
      const permissions = stats.mode & 0o777;
      expect(permissions).toBe(0o600);
    });

    it("overwrites existing file", async () => {
      await writeTokens(sampleTokens, storePath);
      const updated = { ...sampleTokens, accessToken: "updated-access-token" };
      await writeTokens(updated, storePath);
      const result = readTokens(storePath);
      expect(result?.accessToken).toBe("updated-access-token");
    });
  });
});
