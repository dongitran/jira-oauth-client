export const DEFAULT_PORT = 30129;
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize";
export const ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token";
export const ATLASSIAN_RESOURCES_URL =
  "https://api.atlassian.com/oauth/token/accessible-resources";
export const DEFAULT_SCOPES = [
  "read:jira-user",
  "read:jira-work",
  "manage:jira-project",
  "write:jira-work",
  "offline_access",
  "read:me",
  "read:board-scope:jira-software",
  "read:sprint:jira-software",
  "write:sprint:jira-software",
];
