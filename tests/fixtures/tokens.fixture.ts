import type { JiraTokens } from "../../src/types.js";

export const sampleTokens: JiraTokens = {
  accessToken: "sample-access-token",
  refreshToken: "sample-refresh-token",
  expiresIn: 3600,
  scope:
    "read:jira-user read:jira-work manage:jira-project write:jira-work offline_access read:me",
  tokenType: "Bearer",
  cloudId: "00000000-0000-0000-0000-000000000001",
  cloudName: "sample-workspace",
  issuedAt: 1_700_000_000_000,
};

export const sampleRefreshedTokens: JiraTokens = {
  ...sampleTokens,
  accessToken: "sample-refreshed-access-token",
  refreshToken: "sample-refreshed-refresh-token",
  issuedAt: 1_700_003_600_000,
};
