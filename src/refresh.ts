import { ATLASSIAN_TOKEN_URL, DEFAULT_TIMEOUT_MS } from "./constants.js";
import { JiraOAuthCallbackError } from "./errors.js";
import { atlassianTokenResponseSchema } from "./schemas.js";
import type { JiraTokens } from "./types.js";

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  existingTokens: JiraTokens,
  tokenUrl: string = ATLASSIAN_TOKEN_URL,
): Promise<JiraTokens> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new JiraOAuthCallbackError(
      `Token refresh failed (${response.status.toString()})`,
    );
  }

  const responseJson: unknown = await response.json();
  const responseResult = atlassianTokenResponseSchema.safeParse(responseJson);

  if (!responseResult.success) {
    throw new JiraOAuthCallbackError("Token refresh response was not valid");
  }

  const data = responseResult.data;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
    cloudId: existingTokens.cloudId,
    cloudName: existingTokens.cloudName,
    issuedAt: Date.now(),
  };
}
