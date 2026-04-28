<div align="center">

# 🔑 `jira-oauth-client`

**Jira OAuth 2.0 for humans — one call to authenticate, works everywhere.**

Opens the browser, spins a local callback server, exchanges the code for tokens, and saves them to disk — so you never have to implement the 3LO flow yourself.

[![npm version](https://img.shields.io/npm/v/jira-oauth-client.svg?style=flat&color=CB3837&logo=npm)](https://www.npmjs.com/package/jira-oauth-client)
[![CI](https://img.shields.io/github/actions/workflow/status/dongitran/jira-oauth-client/ci.yml?branch=main&style=flat&label=CI)](https://github.com/dongitran/jira-oauth-client/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/jira-oauth-client.svg?style=flat&color=blue)](./LICENSE)
[![node](https://img.shields.io/node/v/jira-oauth-client.svg?style=flat&color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/jira-oauth-client.svg?style=flat&color=3178C6&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[Install](#-install) • [Quick Start](#-quick-start) • [Prerequisites](#-prerequisites) • [API](#-api-reference) • [VS Code](#-vs-code-extension) • [FAQ](#-faq)

</div>

---

## ✨ Features

- 🚀 **Full 3LO flow in one call** — `authenticate()` handles the entire browser-based OAuth loop
- 🔄 **Token refresh** — keep tokens alive without re-authenticating
- 💾 **Automatic persistence** — tokens saved to `~/.jira-oauth/tokens.json` with `chmod 0600`
- 📦 **Dual CJS + ESM** — works in VS Code extensions, bundlers, and plain Node.js scripts
- 🔒 **CSRF protection** — UUID state token validated on every callback
- ⏱️ **Auto-timeout** — authentication flow cancels after 5 minutes
- 🌍 **Env-var friendly** — falls back to `JIRA_CLIENT_ID` / `JIRA_CLIENT_SECRET` when no options passed
- 🔷 **Fully typed** — complete TypeScript definitions included

---

## 📦 Install

```bash
npm install jira-oauth-client
# pnpm add jira-oauth-client
# yarn add jira-oauth-client
```

> [!NOTE]
> Requires **Node.js ≥ 20**.

---

## 🚀 Quick Start

```typescript
import { JiraOAuthClient } from 'jira-oauth-client'

const client = new JiraOAuthClient()

// Opens browser → user logs in → tokens returned and saved automatically
const tokens = await client.authenticate()

// Use tokens.accessToken as a Bearer token with Jira REST API.
// Do not log or expose OAuth tokens.
```

Set credentials from your shell or secrets manager before running:

```bash
# JIRA_CLIENT_ID
# JIRA_CLIENT_SECRET
```

---

## 📋 Prerequisites

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/) and create an **OAuth 2.0 (3LO)** integration
2. Add callback URL: `http://localhost:30129/callback`
3. Under **Permissions**, configure each API:

   | API | Scopes |
   |-----|--------|
   | **Jira API** | `read:jira-user`, `read:jira-work`, `manage:jira-project`, `write:jira-work`, `read:board-scope:jira-software`, `read:sprint:jira-software`, `write:sprint:jira-software` |
   | **User Identity API** | `read:me` |
   | **Jira API (offline)** | `offline_access` |

4. Copy your **Client ID** and **Client Secret**

---

## 🧑‍💻 API Reference

### `new JiraOAuthClient(options?)`

```typescript
const client = new JiraOAuthClient({
  clientId?: string,        // fallback: process.env.JIRA_CLIENT_ID
  clientSecret?: string,    // fallback: process.env.JIRA_CLIENT_SECRET
  port?: number,            // default: 30129
  tokenStorePath?: string,  // default: ~/.jira-oauth/tokens.json
  scopes?: string[],        // default: full Jira scope set
  openBrowser?: (authorizationUrl: string) => unknown | Promise<unknown>
  urls?: {
    authUrl?: string,
    tokenUrl?: string,
    resourcesUrl?: string,
  }
})
```

Throws `JiraOAuthConfigError` immediately if `clientId` or `clientSecret` cannot be resolved.

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `authenticate()` | `Promise<JiraTokens>` | Run full OAuth flow — opens browser, waits for callback, saves and returns tokens |
| `refresh(refreshToken)` | `Promise<JiraTokens>` | Exchange a refresh token for a new access token |
| `getStoredTokens()` | `JiraTokens \| null` | Read persisted tokens from disk synchronously |
| `saveTokens(tokens)` | `Promise<void>` | Write tokens to disk with `chmod 0600` |

### `JiraTokens`

```typescript
interface JiraTokens {
  accessToken: string    // Bearer token for Jira REST API
  refreshToken: string   // use with refresh() to get new access tokens
  expiresIn: number      // seconds until access token expires
  scope: string          // space-separated granted scopes
  tokenType: string      // always "Bearer"
  cloudId: string        // Atlassian cloud instance ID (needed for REST calls)
  cloudName: string      // workspace display name
  issuedAt: number       // Date.now() when tokens were saved
}
```

### Error types

| Class | Code | When thrown |
|-------|------|-------------|
| `JiraOAuthConfigError` | `CONFIG_ERROR` | Missing `clientId` / `clientSecret`, or `refresh()` called before first authenticate |
| `JiraOAuthTimeoutError` | `AUTH_TIMEOUT` | Browser flow not completed within 5 minutes |
| `JiraOAuthCallbackError` | `CALLBACK_ERROR` | Atlassian returned an error, state mismatch (CSRF), or token exchange failed |

All error classes extend `JiraOAuthError`, so you can catch the base class:

```typescript
import { JiraOAuthError, JiraOAuthTimeoutError } from 'jira-oauth-client'

try {
  const tokens = await client.authenticate()
} catch (error) {
  if (error instanceof JiraOAuthTimeoutError) {
    // user didn't complete login in time
  } else if (error instanceof JiraOAuthError) {
    console.error(error.code, error.message)
  }
}
```

---

## 🔄 Token Lifecycle

```typescript
// 1. First-time auth — opens browser
const tokens = await client.authenticate()

// 2. Later — check stored tokens before re-authenticating
const stored = client.getStoredTokens()
if (stored) {
  const ageMs = Date.now() - stored.issuedAt
  const expiredMs = stored.expiresIn * 1000

  if (ageMs < expiredMs) {
    // still valid — use stored.accessToken directly
  } else {
    // expired — refresh silently
    const fresh = await client.refresh(stored.refreshToken)
  }
}

// 3. Save externally-obtained tokens
await client.saveTokens(tokens)
```

---

## 🛠️ VS Code Extension

The package ships both CJS and ESM. VS Code extensions run in a CJS host and automatically resolve `dist/index.cjs`:

```typescript
// extension.ts
import { JiraOAuthClient, JiraOAuthTimeoutError } from 'jira-oauth-client'

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const client = new JiraOAuthClient({
    clientId: context.globalState.get<string>('jiraClientId'),
    clientSecret: context.globalState.get<string>('jiraClientSecret'),
  })

  context.subscriptions.push(
    vscode.commands.registerCommand('myext.login', async () => {
      try {
        const tokens = await client.authenticate()
        await context.secrets.store('jiraAccessToken', tokens.accessToken)
        void vscode.window.showInformationMessage('Jira connected ✓')
      } catch (error) {
        if (error instanceof JiraOAuthTimeoutError) {
          void vscode.window.showWarningMessage('Login timed out — please try again')
        }
      }
    }),
  )
}
```

---

## 🔒 Security

> [!WARNING]
> Tokens are sensitive OAuth credentials. Follow these rules:
> - Token file `~/.jira-oauth/tokens.json` is written with `chmod 0600` — owner read/write only
> - Never log, expose, or commit `accessToken`, `refreshToken`, or `clientSecret`
> - Add `~/.jira-oauth/` to your global `.gitignore`
> - For distributed integrations, use one Atlassian 3LO app that you own and distribute; do not ask each customer to create and share their own app credentials.

---

## ❓ FAQ

<details>
<summary><b>Why port 30129 specifically?</b></summary>

The redirect URI must be registered in your Atlassian OAuth app. Using a fixed port means you only register it once and never change it. Port 30129 was chosen to avoid conflicts with common dev ports (3000, 8080, etc.).

</details>

<details>
<summary><b>What happens if port 30129 is already in use?</b></summary>

`authenticate()` will throw a Node.js `EADDRINUSE` error. Stop whatever is using the port, or pass a different `port` option (and update your Atlassian app's callback URL to match).

</details>

<details>
<summary><b>Can I use this without opening a browser (e.g. in CI)?</b></summary>

No — the 3LO flow requires a human to log in. For CI use cases, generate tokens locally first with `authenticate()`, persist them, and then use `refresh()` to keep them alive in your pipeline.

</details>

<details>
<summary><b>Which Jira workspace is used when the account has multiple?</b></summary>

The first resource returned by `/oauth/token/accessible-resources` is used. This is typically the primary workspace. If you need a specific one, pass a custom `scopes` array or handle workspace selection manually using the returned `cloudId`.

</details>

<details>
<summary><b>Is <code>~/.jira-oauth/tokens.json</code> safe to commit?</b></summary>

**No.** It contains live OAuth tokens. It is written with `chmod 0600` and should be treated like a private key. Add it to your `.gitignore`.

</details>

---

## 🛠️ Development

```bash
git clone https://github.com/dongitran/jira-oauth-client.git
cd jira-oauth-client
pnpm install

pnpm build        # tsup — produces dist/index.cjs + dist/index.mjs
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint src tests
pnpm test:unit    # vitest run --coverage
pnpm test:e2e:mock  # playwright e2e against a local mock Atlassian server
pnpm check        # lint + typecheck + test:unit
```

---

<div align="center">

Made with ❤️ by [dongtran](https://github.com/dongitran)

**License** · [MIT](./LICENSE)

</div>
