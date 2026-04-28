import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JiraOAuthClient } from "../../src/client.js";
import { JiraOAuthConfigError } from "../../src/errors.js";
import { sampleTokens } from "../fixtures/tokens.fixture.js";

describe("JiraOAuthClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["JIRA_CLIENT_ID"];
    delete process.env["JIRA_CLIENT_SECRET"];
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("accepts clientId and clientSecret as direct options", () => {
      expect(
        () => new JiraOAuthClient({ clientId: "id", clientSecret: "credential" }),
      ).not.toThrow();
    });

    it("falls back to JIRA_CLIENT_ID env variable", () => {
      process.env["JIRA_CLIENT_ID"] = "env-id";
      process.env["JIRA_CLIENT_SECRET"] = "env-credential";
      expect(() => new JiraOAuthClient()).not.toThrow();
    });

    it("throws JiraOAuthConfigError when clientId is missing", () => {
      expect(() => new JiraOAuthClient({ clientSecret: "credential" })).toThrow(
        JiraOAuthConfigError,
      );
    });

    it("throws JiraOAuthConfigError when clientSecret is missing", () => {
      expect(() => new JiraOAuthClient({ clientId: "id" })).toThrow(JiraOAuthConfigError);
    });

    it("throws JiraOAuthConfigError when both credentials are missing", () => {
      expect(() => new JiraOAuthClient()).toThrow(JiraOAuthConfigError);
    });

    it("error message mentions JIRA_CLIENT_ID env var when clientId missing", () => {
      expect(() => new JiraOAuthClient({ clientSecret: "credential" })).toThrow(
        /JIRA_CLIENT_ID/,
      );
    });

    it("error message mentions JIRA_CLIENT_SECRET env var when clientSecret missing", () => {
      expect(() => new JiraOAuthClient({ clientId: "id" })).toThrow(/JIRA_CLIENT_SECRET/);
    });

    it("options take precedence over env variables", () => {
      process.env["JIRA_CLIENT_ID"] = "env-id";
      process.env["JIRA_CLIENT_SECRET"] = "env-credential";
      expect(
        () => new JiraOAuthClient({ clientId: "option-id", clientSecret: "option-credential" }),
      ).not.toThrow();
    });
  });

  describe("getStoredTokens", () => {
    it("returns null when no tokens are stored", () => {
      const client = new JiraOAuthClient({
        clientId: "id",
        clientSecret: "credential",
        tokenStorePath: "/tmp/nonexistent-jira-test-tokens.json",
      });
      expect(client.getStoredTokens()).toBeNull();
    });
  });

  describe("refresh", () => {
    it("throws JiraOAuthConfigError when no stored tokens exist", async () => {
      const client = new JiraOAuthClient({
        clientId: "id",
        clientSecret: "credential",
        tokenStorePath: "/tmp/nonexistent-jira-test-tokens.json",
      });
      await expect(client.refresh("sample-refresh-token")).rejects.toThrow(
        JiraOAuthConfigError,
      );
    });

    it("uses the configured token endpoint when refreshing stored tokens", async () => {
      vi.stubGlobal("fetch", vi.fn());
      const tokenStorePath = join(tmpdir(), `jira-client-test-${Date.now().toString()}.json`);
      const client = new JiraOAuthClient({
        clientId: "id",
        clientSecret: "credential",
        tokenStorePath,
        urls: { tokenUrl: "http://127.0.0.1:39001/oauth/token" },
      });

      await client.saveTokens(sampleTokens);

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "refreshed-access-token",
            refresh_token: "refreshed-refresh-token",
            expires_in: 3600,
            scope: "read:jira-user",
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      await client.refresh(sampleTokens.refreshToken);

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://127.0.0.1:39001/oauth/token");

      if (existsSync(tokenStorePath)) {
        rmSync(tokenStorePath);
      }
    });
  });
});
