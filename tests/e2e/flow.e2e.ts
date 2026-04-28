import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:http";

import { expect, test } from "@playwright/test";

import { JiraOAuthClient } from "../../src/client.js";
import { sampleTokens } from "../fixtures/tokens.fixture.js";

const MOCK_ATLASSIAN_PORT = 39_001;
const OAUTH_CLIENT_PORT = 30_129;
const MOCK_BASE_URL = `http://127.0.0.1:${MOCK_ATLASSIAN_PORT.toString()}`;

const mockUrls = {
  authUrl: `${MOCK_BASE_URL}/authorize`,
  tokenUrl: `${MOCK_BASE_URL}/oauth/token`,
  resourcesUrl: `${MOCK_BASE_URL}/oauth/token/accessible-resources`,
};

test.describe("JiraOAuthClient OAuth flow with local Atlassian server", () => {
  let mockAtlassianServer: ReturnType<typeof createServer>;

  test.beforeAll(async () => {
    mockAtlassianServer = createServer((req, res) => {
      const url = new URL(req.url ?? "/", MOCK_BASE_URL);

      if (url.pathname === "/authorize") {
        const redirectUri = url.searchParams.get("redirect_uri");
        const state = url.searchParams.get("state");

        if (!redirectUri || !state) {
          res.writeHead(400);
          res.end("Request could not be completed");
          return;
        }

        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set("code", "sample-authorization-code");
        callbackUrl.searchParams.set("state", state);
        res.writeHead(302, { Location: callbackUrl.toString() });
        res.end();
        return;
      }

      if (url.pathname === "/oauth/token") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            access_token: sampleTokens.accessToken,
            refresh_token: sampleTokens.refreshToken,
            expires_in: sampleTokens.expiresIn,
            scope: sampleTokens.scope,
            token_type: sampleTokens.tokenType,
          }),
        );
        return;
      }

      if (url.pathname === "/oauth/token/accessible-resources") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify([
            {
              id: sampleTokens.cloudId,
              name: sampleTokens.cloudName,
              url: "https://sample-workspace.atlassian.net",
              scopes: [],
              avatarUrl: "",
            },
          ]),
        );
        return;
      }

      res.writeHead(404);
      res.end("Route not found");
    });

    await new Promise<void>((resolve) => {
      mockAtlassianServer.listen(MOCK_ATLASSIAN_PORT, "127.0.0.1", () => {
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => {
      mockAtlassianServer.closeAllConnections();
      mockAtlassianServer.close(() => {
        resolve();
      });
    });
  });

  test("User can complete the OAuth flow and store tokens", async ({ page }) => {
    const tokenStorePath = `/tmp/jira-e2e-test-${Date.now().toString()}.json`;

    const client = new JiraOAuthClient({
      clientId: "test-client-id",
      clientSecret: "test-client-credential",
      port: OAUTH_CLIENT_PORT,
      tokenStorePath,
      urls: mockUrls,
      openBrowser: async (authorizationUrl) => {
        await page.goto(authorizationUrl);
      },
    });

    const tokens = await client.authenticate();

    expect(tokens).toMatchObject({
      accessToken: sampleTokens.accessToken,
      refreshToken: sampleTokens.refreshToken,
      cloudId: sampleTokens.cloudId,
      cloudName: sampleTokens.cloudName,
    });
    await expect(page.getByRole("heading", { name: "Authentication Successful" })).toBeVisible();
    expect(client.getStoredTokens()?.accessToken).toBe(sampleTokens.accessToken);

    removeFileIfPresent(tokenStorePath);
  });

  test("User can see a neutral error page when state verification cannot be completed", async ({
    page,
  }) => {
    const tokenStorePath = `/tmp/jira-e2e-state-${Date.now().toString()}.json`;
    let resolveAuthorizationUrl: (authorizationUrl: string) => void;
    const authorizationUrlReady = new Promise<string>((resolve) => {
      resolveAuthorizationUrl = resolve;
    });

    const client = new JiraOAuthClient({
      clientId: "test-client-id",
      clientSecret: "test-client-credential",
      port: OAUTH_CLIENT_PORT,
      tokenStorePath,
      urls: mockUrls,
      openBrowser: (authorizationUrl) => {
        resolveAuthorizationUrl(authorizationUrl);
      },
    });

    const authPromise = client.authenticate();
    const authExpectation = expect(authPromise).rejects.toThrow("State verification failed");
    const authorizationUrl = await authorizationUrlReady;
    const redirectUri = new URL(authorizationUrl).searchParams.get("redirect_uri");

    expect(redirectUri).not.toBeNull();

    const callbackUrl = new URL(redirectUri ?? `http://localhost:${OAUTH_CLIENT_PORT.toString()}`);
    callbackUrl.searchParams.set("code", "sample-authorization-code");
    callbackUrl.searchParams.set("state", "alternate-state");

    await page.goto(callbackUrl.toString());

    await expect(
      page.getByRole("heading", { name: "Authentication Could Not Be Completed" }),
    ).toBeVisible();
    await expect(page.getByText("State verification could not be completed")).toBeVisible();
    await authExpectation;
    removeFileIfPresent(tokenStorePath);
  });

  test("User can inspect an empty token store", () => {
    const client = new JiraOAuthClient({
      clientId: "test-client-id",
      clientSecret: "test-client-credential",
      tokenStorePath: "/tmp/nonexistent-e2e-tokens.json",
      urls: mockUrls,
    });

    expect(client.getStoredTokens()).toBeNull();
  });

  test("User can save and read tokens", async () => {
    const tokenStorePath = `/tmp/jira-e2e-save-${Date.now().toString()}.json`;

    const client = new JiraOAuthClient({
      clientId: "test-client-id",
      clientSecret: "test-client-credential",
      tokenStorePath,
      urls: mockUrls,
    });

    await client.saveTokens(sampleTokens);
    const stored = client.getStoredTokens();

    expect(stored).toEqual(sampleTokens);
    removeFileIfPresent(tokenStorePath);
  });
});

function removeFileIfPresent(path: string): void {
  if (existsSync(path)) {
    rmSync(path);
  }
}
