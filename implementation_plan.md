# Implementation Plan

## Goal

Harden `jira-oauth-client` around OAuth flow reliability, token persistence, dependency security, and test wording. Keep the package API backward-compatible while adding narrow hooks needed for deterministic E2E coverage.

## Findings Addressed

1. `tests/e2e/flow.e2e.ts` failed because the flow test used an alternate state and `waitForTimeout`.
2. `refreshAccessToken` always called the production Atlassian token endpoint, even when `JiraOAuthOptions.urls.tokenUrl` was supplied.
3. External JSON from Atlassian and token-store files was cast directly without runtime validation.
4. The callback server was not explicitly loopback-bound.
5. Token and accessible-resource fetches had no request timeout after callback arrival.
6. Token writes were not atomic and applied permissions after the file was written.
7. `uuid` was unnecessary on Node >=20 and triggered an audit advisory.
8. README examples logged token values.
9. Unit/E2E wording included non-neutral sample names.

## Files Touched

- `src/types.ts`: added a typed `openBrowser` option.
- `src/flow.ts`: switched to `crypto.randomUUID`, added injectable opener, loopback listen host, fetch timeouts, safer error text, response validation, and smaller helpers.
- `src/refresh.ts`: added optional token URL override and validated token responses.
- `src/client.ts`: stores/passes `openBrowser` and forwards `urls.tokenUrl` into refresh.
- `src/token-store.ts`: validates parsed/saved token payloads and writes atomically with owner-only permissions.
- `src/schemas.ts`: shared Zod schemas for Atlassian responses and stored tokens.
- `src/index.ts`: exports the new public opener type.
- `tests/fixtures/tokens.fixture.ts`: renamed fixtures to neutral sample terminology.
- `tests/unit/*.test.ts`: added validation, token endpoint override, and token-store permission coverage.
- `tests/e2e/flow.e2e.ts`: rewrote the browser flow against a local mock Atlassian server without sleeps.
- `playwright.config.ts`: configured trace/screenshot only on failure paths.
- `package.json` / `pnpm-lock.yaml`: removed `uuid`, added `zod`, patched `@eslint/plugin-kit`, and renamed the mock E2E script.
- `README.md`, `AGENTS.md`, `.github/workflows/ci.yml`: updated docs/CI to match the hardened flow.

## Verification Completed

1. `pnpm check`
2. `pnpm build`
3. `pnpm test:e2e:mock`
4. `pnpm audit --audit-level low`
5. `npm pack --dry-run`
6. Final `rg` review for sensitive or non-neutral wording in unit/E2E tests and fixtures.
