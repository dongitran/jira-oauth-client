export class JiraOAuthError extends Error {
  public readonly code: string;

  public constructor(message: string, code: string) {
    super(message);
    this.name = "JiraOAuthError";
    this.code = code;
  }
}

export class JiraOAuthTimeoutError extends JiraOAuthError {
  public constructor(timeoutMs: number) {
    super(
      `Authentication timed out after ${String(timeoutMs / 1000)}s. The browser flow was not completed in time.`,
      "AUTH_TIMEOUT",
    );
    this.name = "JiraOAuthTimeoutError";
  }
}

export class JiraOAuthConfigError extends JiraOAuthError {
  public constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "JiraOAuthConfigError";
  }
}

export class JiraOAuthCallbackError extends JiraOAuthError {
  public constructor(message: string) {
    super(message, "CALLBACK_ERROR");
    this.name = "JiraOAuthCallbackError";
  }
}
