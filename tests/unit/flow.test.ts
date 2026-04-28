import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JiraOAuthCallbackError, JiraOAuthTimeoutError } from "../../src/errors.js";

vi.mock("open", () => ({ default: vi.fn().mockResolvedValue(undefined) }));

describe("runOAuthFlow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports JiraOAuthTimeoutError for timeout scenarios", () => {
    const error = new JiraOAuthTimeoutError(300_000);
    expect(error.code).toBe("AUTH_TIMEOUT");
    expect(error.message).toContain("300s");
    expect(error).toBeInstanceOf(JiraOAuthTimeoutError);
  });

  it("exports JiraOAuthCallbackError for callback errors", () => {
    const error = new JiraOAuthCallbackError("State verification failed");
    expect(error.code).toBe("CALLBACK_ERROR");
    expect(error.message).toContain("State verification failed");
  });

  it("JiraOAuthTimeoutError is an instance of JiraOAuthCallbackError's base class", async () => {
    const error = new JiraOAuthTimeoutError(300_000);
    const { JiraOAuthError } = await import("../../src/errors.js");
    expect(error).toBeInstanceOf(JiraOAuthError);
  });
});
