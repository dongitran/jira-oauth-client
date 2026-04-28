# AGENTS.md — jira-oauth-client

## Scope

This file applies to the entire `jira-oauth-client` repository. Explicit user instructions in chat take precedence. The `.agents/rules/` folder contains stricter reusable rules — use them as defaults.

## Project Overview

`jira-oauth-client` is a TypeScript library that implements the Jira/Atlassian OAuth 2.0 (3LO) flow. It spins up a temporary local server on port 30129, opens the browser, handles the callback, exchanges the code for tokens, and persists them to `~/.jira-oauth/tokens.json`. Designed for reuse in VS Code extensions, CLI tools, and scripts.

- **Dual package**: ships both CJS (`dist/index.cjs`) and ESM (`dist/index.mjs`)
- **Node >=20**, pnpm, TypeScript strict mode, `module: NodeNext`

## Commands

```bash
pnpm install
pnpm build        # tsup — produces dist/index.cjs + dist/index.mjs
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint src tests
pnpm test:unit    # vitest run --coverage
pnpm test:e2e:mock  # playwright test (mock Atlassian server)
pnpm check        # lint + typecheck + test:unit
```

## Required Workflow

- Before modifying source, trace existing behavior with `rg` and direct file reads.
- Prefer existing helpers over new abstractions.
- Never run `git commit --no-verify` or bypass Husky hooks.
- Treat untracked/dirty files as user work — do not overwrite without explicit instruction.

## TypeScript and Style

- Strict mode enforced. No `any`, no `@ts-ignore`, no non-null assertions in `src/`.
- Annotate all async function return types explicitly.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- Include `.js` extensions in all relative imports (NodeNext resolution).
- No `console.*` in `src/` — library code must be silent.
- Guard clauses over nested branches.

## Architecture

- `src/types.ts` — all shared interfaces (`JiraTokens`, `JiraOAuthOptions`, Atlassian response types)
- `src/errors.ts` — typed error hierarchy (`JiraOAuthError` base, subclasses for each failure mode)
- `src/token-store.ts` — pure fs read/write, no side effects beyond the file system
- `src/refresh.ts` — pure HTTP, no file I/O
- `src/flow.ts` — Express server lifecycle + browser open + Atlassian HTTP calls
- `src/client.ts` — orchestrates the above; the only public entry point consumers instantiate

## Testing

- Unit tests use Vitest. Coverage thresholds: 80% lines/functions/branches/statements.
- E2E tests use Playwright with a mock local Atlassian server — no real credentials needed.
- Do not run live Atlassian E2E unless the user explicitly requests it.
- Do not weaken coverage thresholds.

## Security

`~/.jira-oauth/tokens.json` contains sensitive OAuth credentials. Rules:
- Always write with `chmod 0600` after saving.
- Never log or expose `accessToken`, `refreshToken`, or `clientSecret`.
- Never commit `.env` files or token files.
- If a diff exposes a secret, stop and alert the user before proceeding.

## Git and Release

- Respect Husky hooks (`pre-commit`: lint + typecheck).
- Do not change `version`, `publishConfig`, or workflow publish behavior unless explicitly asked.
- Use concise commit messages when the user requests a commit.
