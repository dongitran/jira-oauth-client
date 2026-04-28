import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";

import express from "express";
import type { RequestHandler } from "express";
import open from "open";

import {
  ATLASSIAN_AUTH_URL,
  ATLASSIAN_RESOURCES_URL,
  ATLASSIAN_TOKEN_URL,
  DEFAULT_PORT,
  DEFAULT_SCOPES,
  DEFAULT_TIMEOUT_MS,
} from "./constants.js";
import { JiraOAuthCallbackError, JiraOAuthTimeoutError } from "./errors.js";
import { atlassianResourcesSchema, atlassianTokenResponseSchema } from "./schemas.js";
import type {
  AtlassianTokenResponse,
  BrowserOpener,
  JiraTokens,
} from "./types.js";

export interface OAuthFlowUrls {
  authUrl?: string;
  tokenUrl?: string;
  resourcesUrl?: string;
}

interface FlowLifecycle {
  fail: (error: Error) => void;
  finish: (tokens: JiraTokens) => void;
  setTimer: (timer: ReturnType<typeof setTimeout>) => void;
}

interface CallbackHandlerOptions {
  clientId: string;
  clientSecret: string;
  lifecycle: FlowLifecycle;
  redirectUri: string;
  resourcesUrl: string;
  state: string;
  tokenUrl: string;
}

export async function runOAuthFlow(
  clientId: string,
  clientSecret: string,
  port: number = DEFAULT_PORT,
  scopes: string[] = DEFAULT_SCOPES,
  urls: OAuthFlowUrls = {},
  openBrowser: BrowserOpener = open,
): Promise<JiraTokens> {
  const authBase = urls.authUrl ?? ATLASSIAN_AUTH_URL;
  const tokenUrl = urls.tokenUrl ?? ATLASSIAN_TOKEN_URL;
  const resourcesUrl = urls.resourcesUrl ?? ATLASSIAN_RESOURCES_URL;

  const state = randomUUID();
  const redirectUri = `http://localhost:${port.toString()}/callback`;
  const fullAuthUrl = buildAuthorizationUrl(authBase, clientId, scopes, redirectUri, state);

  return await new Promise<JiraTokens>((resolve, reject) => {
    const app = express();
    const server = createServer(app);
    const lifecycle = createFlowLifecycle(server, resolve, reject);
    lifecycle.setTimer(
      setTimeout(() => {
        lifecycle.fail(new JiraOAuthTimeoutError(DEFAULT_TIMEOUT_MS));
      }, DEFAULT_TIMEOUT_MS),
    );

    app.get(
      "/callback",
      createOAuthCallbackHandler({
        clientId,
        clientSecret,
        lifecycle,
        redirectUri,
        resourcesUrl,
        state,
        tokenUrl,
      }),
    );

    startAuthorizationServer(server, port, fullAuthUrl, openBrowser, lifecycle);
  });
}

function buildAuthorizationUrl(
  authBase: string,
  clientId: string,
  scopes: string[],
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: scopes.join(" "),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `${authBase}?${params.toString()}`;
}

function createFlowLifecycle(
  server: Server,
  resolve: (tokens: JiraTokens) => void,
  reject: (error: Error) => void,
): FlowLifecycle {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const closeServer = (): void => {
    if (timer) {
      clearTimeout(timer);
    }

    server.closeAllConnections();
    server.close();
  };

  return {
    fail: (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      closeServer();
      reject(error);
    },
    finish: (tokens: JiraTokens): void => {
      if (settled) {
        return;
      }

      settled = true;
      closeServer();
      resolve(tokens);
    },
    setTimer: (nextTimer: ReturnType<typeof setTimeout>): void => {
      timer = nextTimer;
    },
  };
}

function createOAuthCallbackHandler(options: CallbackHandlerOptions): RequestHandler {
  return (req, res): void => {
    const { code, state: returnedState, error } = req.query;

    if (typeof error === "string") {
      res.status(400).send(buildErrorPage(escapeHtml(error)));
      options.lifecycle.fail(new JiraOAuthCallbackError(`Atlassian returned error: ${error}`));
      return;
    }

    if (typeof code !== "string" || typeof returnedState !== "string") {
      res.status(400).send(buildErrorPage("Missing code or state parameter"));
      options.lifecycle.fail(new JiraOAuthCallbackError("Missing code or state in callback"));
      return;
    }

    if (returnedState !== options.state) {
      res.status(400).send(buildErrorPage("State verification could not be completed"));
      options.lifecycle.fail(new JiraOAuthCallbackError("State verification failed"));
      return;
    }

    void exchangeCodeForTokens(
      code,
      options.clientId,
      options.clientSecret,
      options.redirectUri,
      options.tokenUrl,
      options.resourcesUrl,
    )
      .then((tokens) => {
        res.send(buildSuccessPage());
        options.lifecycle.finish(tokens);
      })
      .catch((exchangeError: unknown) => {
        const message = exchangeError instanceof Error ? exchangeError.message : "Unknown error";
        res.status(500).send(buildErrorPage(escapeHtml(message)));
        options.lifecycle.fail(
          exchangeError instanceof Error ? exchangeError : new JiraOAuthCallbackError(message),
        );
      });
  };
}

function startAuthorizationServer(
  server: Server,
  port: number,
  fullAuthUrl: string,
  openBrowser: BrowserOpener,
  lifecycle: FlowLifecycle,
): void {
  server.listen(port, "localhost", () => {
    void Promise.resolve(openBrowser(fullAuthUrl)).catch((openError: unknown) => {
      const message = openError instanceof Error ? openError.message : "Unknown browser error";
      lifecycle.fail(new JiraOAuthCallbackError(`Unable to open authorization URL: ${message}`));
    });
  });

  server.on("error", (err: Error) => {
    lifecycle.fail(err);
  });
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenUrl: string,
  resourcesUrl: string,
): Promise<JiraTokens> {
  const tokenData = await requestTokenData(code, clientId, clientSecret, redirectUri, tokenUrl);
  const primaryResource = await requestPrimaryResource(resourcesUrl, tokenData.access_token);

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    scope: tokenData.scope,
    tokenType: tokenData.token_type,
    cloudId: primaryResource.id,
    cloudName: primaryResource.name,
    issuedAt: Date.now(),
  };
}

async function requestTokenData(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenUrl: string,
): Promise<AtlassianTokenResponse> {
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new JiraOAuthCallbackError(
      `Token exchange failed (${tokenResponse.status.toString()})`,
    );
  }

  const tokenJson: unknown = await tokenResponse.json();
  const tokenResult = atlassianTokenResponseSchema.safeParse(tokenJson);

  if (!tokenResult.success) {
    throw new JiraOAuthCallbackError("Token exchange response was not valid");
  }

  const tokenData = tokenResult.data;
  return tokenData;
}

async function requestPrimaryResource(
  resourcesUrl: string,
  accessToken: string,
): Promise<{ id: string; name: string }> {
  const resourcesResponse = await fetch(resourcesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!resourcesResponse.ok) {
    throw new JiraOAuthCallbackError(
      `Failed to fetch accessible resources (${resourcesResponse.status.toString()})`,
    );
  }

  const resourcesJson: unknown = await resourcesResponse.json();
  const resourcesResult = atlassianResourcesSchema.safeParse(resourcesJson);

  if (!resourcesResult.success) {
    throw new JiraOAuthCallbackError("Accessible resources response was not valid");
  }

  const resources = resourcesResult.data;
  const primaryResource = resources[0];

  if (!primaryResource) {
    throw new JiraOAuthCallbackError("No accessible Jira resources found for this account");
  }

  return primaryResource;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authentication Successful</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
    .card { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #15803d; margin: 0 0 8px; font-size: 22px; }
    p { color: #6b7280; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Authentication Successful</h1>
    <p>You can close this window and return to your application.</p>
  </div>
</body>
</html>`;
}

function buildErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authentication Could Not Be Completed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fef2f2; }
    .card { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #dc2626; margin: 0 0 8px; font-size: 22px; }
    p { color: #6b7280; margin: 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Authentication Could Not Be Completed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
