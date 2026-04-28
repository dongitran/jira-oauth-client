export type BrowserOpener = (authorizationUrl: string) => unknown;

export interface JiraOAuthOptions {
  clientId?: string;
  clientSecret?: string;
  port?: number;
  tokenStorePath?: string;
  scopes?: string[];
  openBrowser?: BrowserOpener;
  urls?: {
    authUrl?: string;
    tokenUrl?: string;
    resourcesUrl?: string;
  };
}

export interface JiraTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
  cloudId: string;
  cloudName: string;
  issuedAt: number;
}

export interface AtlassianTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface AtlassianResource {
  id: string;
  name: string;
  url?: string;
  scopes: string[];
  avatarUrl?: string;
}
