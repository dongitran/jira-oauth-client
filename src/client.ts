import { DEFAULT_PORT } from "./constants.js";
import { JiraOAuthConfigError } from "./errors.js";
import { runOAuthFlow } from "./flow.js";
import type { OAuthFlowUrls } from "./flow.js";
import { refreshAccessToken } from "./refresh.js";
import { readTokens, writeTokens } from "./token-store.js";
import type { BrowserOpener, JiraOAuthOptions, JiraTokens } from "./types.js";

export class JiraOAuthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly port: number;
  private readonly tokenStorePath: string | undefined;
  private readonly scopes: string[] | undefined;
  private readonly urls: OAuthFlowUrls | undefined;
  private readonly openBrowser: BrowserOpener | undefined;

  public constructor(options: JiraOAuthOptions = {}) {
    const clientId = options.clientId ?? process.env["JIRA_CLIENT_ID"];
    const clientSecret = options.clientSecret ?? process.env["JIRA_CLIENT_SECRET"];

    if (!clientId) {
      throw new JiraOAuthConfigError(
        "clientId is required. Pass it as an option or set the JIRA_CLIENT_ID environment variable.",
      );
    }

    if (!clientSecret) {
      throw new JiraOAuthConfigError(
        "clientSecret is required. Pass it as an option or set the JIRA_CLIENT_SECRET environment variable.",
      );
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.port = options.port ?? DEFAULT_PORT;
    this.tokenStorePath = options.tokenStorePath;
    this.scopes = options.scopes;
    this.urls = options.urls;
    this.openBrowser = options.openBrowser;
  }

  public async authenticate(): Promise<JiraTokens> {
    const tokens = await runOAuthFlow(
      this.clientId,
      this.clientSecret,
      this.port,
      this.scopes,
      this.urls,
      this.openBrowser,
    );

    await writeTokens(tokens, this.tokenStorePath);

    return tokens;
  }

  public async refresh(refreshToken: string): Promise<JiraTokens> {
    const existing = this.getStoredTokens();

    if (!existing) {
      throw new JiraOAuthConfigError(
        "No stored tokens found. Call authenticate() first to obtain initial tokens.",
      );
    }

    const tokens = await refreshAccessToken(
      this.clientId,
      this.clientSecret,
      refreshToken,
      existing,
      this.urls?.tokenUrl,
    );

    await writeTokens(tokens, this.tokenStorePath);

    return tokens;
  }

  public getStoredTokens(): JiraTokens | null {
    return readTokens(this.tokenStorePath);
  }

  public async saveTokens(tokens: JiraTokens): Promise<void> {
    await writeTokens(tokens, this.tokenStorePath);
  }
}
