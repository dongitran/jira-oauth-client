import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JiraOAuthCallbackError } from "../../src/errors.js";
import { refreshAccessToken } from "../../src/refresh.js";
import { sampleRefreshedTokens, sampleTokens } from "../fixtures/tokens.fixture.js";

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns refreshed JiraTokens on success", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: sampleRefreshedTokens.accessToken,
          refresh_token: sampleRefreshedTokens.refreshToken,
          expires_in: sampleRefreshedTokens.expiresIn,
          scope: sampleRefreshedTokens.scope,
          token_type: sampleRefreshedTokens.tokenType,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await refreshAccessToken(
      "client-id",
      "client-credential",
      sampleTokens.refreshToken,
      sampleTokens,
    );

    expect(result.accessToken).toBe(sampleRefreshedTokens.accessToken);
    expect(result.refreshToken).toBe(sampleRefreshedTokens.refreshToken);
    expect(result.cloudId).toBe(sampleTokens.cloudId);
    expect(result.cloudName).toBe(sampleTokens.cloudName);
    expect(result.issuedAt).toBeGreaterThan(0);
  });

  it("preserves cloudId and cloudName from existing tokens", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "sample-access-token-next",
          refresh_token: "sample-refresh-token-next",
          expires_in: 3600,
          scope: "read:jira-user",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await refreshAccessToken(
      "id",
      "credential",
      "sample-refresh-token",
      sampleTokens,
    );

    expect(result.cloudId).toBe(sampleTokens.cloudId);
    expect(result.cloudName).toBe(sampleTokens.cloudName);
  });

  it("throws when Atlassian returns a non-ok response", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      refreshAccessToken("id", "credential", "alternate-refresh-token", sampleTokens),
    ).rejects.toThrow(/Token refresh failed/);
  });

  it("throws JiraOAuthCallbackError when the response shape is not supported", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "sample-access-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      refreshAccessToken("id", "credential", "sample-refresh-token", sampleTokens),
    ).rejects.toThrow(JiraOAuthCallbackError);
  });

  it("sends correct request body to Atlassian", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "sample-access-token",
          refresh_token: "sample-refresh-token",
          expires_in: 3600,
          scope: "read:jira-user",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await refreshAccessToken(
      "my-client-id",
      "my-client-credential",
      "my-refresh-token",
      sampleTokens,
    );

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://auth.atlassian.com/oauth/token");
    const body = JSON.parse(options.body as string) as Record<string, string>;
    expect(body["grant_type"]).toBe("refresh_token");
    expect(body["client_id"]).toBe("my-client-id");
    expect(body["refresh_token"]).toBe("my-refresh-token");
  });

  it("uses a configured token endpoint when provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "custom-access-token",
          refresh_token: "custom-refresh-token",
          expires_in: 3600,
          scope: "read:jira-user",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await refreshAccessToken(
      "client-id",
      "client-credential",
      "sample-refresh-token",
      sampleTokens,
      "http://127.0.0.1:39001/oauth/token",
    );

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:39001/oauth/token");
  });
});
