# secure-data-vault

Reference architecture for storing regulated data with application-layer encryption and tamper-evident audit trails.

## Workspace Layout

Yarn 4 monorepo with `nodeLinker: node-modules`.

| Workspace               | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `packages/shared-types` | Zod schemas + inferred TS types for all API boundaries        |
| `packages/crypto-core`  | AES-256-GCM envelope encryption (zero external deps)          |
| `packages/audit-core`   | Hash-chained audit log with HMAC-SHA-256 (zero external deps) |
| `apps/vault-api`        | NestJS 11 API backed by Postgres 16 via Drizzle ORM           |
| `apps/admin-console`    | Angular 21 SPA for record management and audit inspection     |

## Strict Rules

1. **Never log decrypted payloads.** All loggable data passes through `safeLog()` which redacts PII-matching keys. Decrypted payloads must only appear in HTTP response bodies.
2. **Always pass AAD on every encrypt/decrypt call.** The AAD is `recordId:tenantId` — omitting it breaks the transplant-attack protection.
3. **Keep crypto-core exports minimal.** Only `encrypt`, `decrypt`, `loadEncryptionKeyset`, `loadMacKeyset`, types, and errors. No raw key material or internal Tink primitives.
4. **audit-core must remain storage-agnostic.** It defines the `AuditStorage` interface; adapters live in the consuming app.
5. **All errors use RFC 7807.** The global `HttpExceptionFilter` enforces `application/problem+json` on every response.
6. **A capability claim in `README.md`, `.context/` or `.agents/` must be true of the code at HEAD.** `docs/STATUS.md` is the matrix of what is actually behind each claim; a change that moves a row updates it in the same pull request. Anything aspirational belongs in `docs/prd/`, not in the present tense.

## Modern Conventions

This repo is a consultancy showcase — always reach for the current-best idiom for each stack. No legacy shims.

**Angular (`apps/admin-console`):**

- Zoneless change detection via `provideZonelessChangeDetection()`. Never reintroduce `provideZoneChangeDetection` or a `zone.js` polyfill.
- State lives in `signal()` / `computed()` / `toSignal()`. Do not `.subscribe()` into plain class fields — view updates won't fire under zoneless.
- Every component uses `changeDetection: ChangeDetectionStrategy.OnPush`.
- DI with `inject()`, not constructor parameters.
- Control flow via `@if` / `@for` / `@switch`; no `*ngIf` / `*ngFor`. Import only the pipes/directives a template needs (no blanket `CommonModule`).
- Standalone is the default — omit `standalone: true` on components.
- For new inputs/outputs use `input()` / `output()` / `model()`.

**Backend (`apps/vault-api`, packages):**

- NestJS 11 standalone-style providers; Drizzle relational queries over raw SQL where practical.
- Prefer native `fetch` / `undici` over `axios`.
- Zod schemas from `packages/shared-types` are the single source of truth for request/response shapes.

## Run Commands

```bash
yarn install            # Install all workspace dependencies
yarn build              # Build packages (topological) then apps
yarn test               # Run all unit tests
yarn dev                # Local dev: Postgres (Docker) + API + UI with hot reload
docker compose up -d    # Full Docker: Postgres + vault-api + admin-console (nginx)
yarn workspace @secure-data-vault/vault-api test:e2e  # E2E tests (needs a fresh Postgres)
yarn typecheck          # tsc --noEmit in every workspace (run yarn build:packages first)
yarn lint               # ESLint in every workspace
yarn lint:docs          # Structural lint for docs/prd, docs/adr and docs/STATUS.md
yarn format:check       # Prettier over **/*.{ts,tsx,json,md}
```

Run `yarn typecheck`, `yarn lint`, `yarn test`, `yarn lint:docs` and `yarn format:check`
before declaring any task complete. The first four gate CI; `format:check` does not yet
(P0-A owns adding it).

## Planned Work

- Planned work lives in `docs/prd/` and is indexed by `docs/prd/README.md`. Read the index
  before proposing new work — it may already be a PRD with a decided approach.
- `docs/STATUS.md` is one row per documented capability with what is actually behind it at
  HEAD and which PRD owns the rest. Read it before trusting a sentence in this file or the
  README.
- Decisions live in `docs/adr/`. Do not contradict an accepted record without superseding it.
- `.agents/prd-author.md` is the prompt for writing or revising a PRD; `AGENTS.md` has the
  routing rule.

## Working on a PRD

`/prd <id>` is the entry point — it implements a PRD that exists, or drafts one for review
if the id is in the index but has no file yet. Two rules apply whether or not the command
was used:

- **Finishing work on a PRD includes updating its `status`, its row in the index, the
  `docs/STATUS.md` rows it moved, and the dated "Where things stand" section at the top of
  `docs/prd/README.md`.** A stale status section is how the next session starts from the
  wrong place.
- **Report what you had to work out that the docs should have told you.** If the answer was
  not in `docs/prd/`, `docs/adr/`, `docs/STATUS.md`, `.context/`, or this file, that is a
  gap in the scaffolding — say so, and close it as part of the task.

## Key Decisions

Recorded as ADRs 0001–0008 in `docs/adr/`. The one-line summaries below are for
orientation; the records carry the context and the consequences, including the two whose
consequences have since stopped being true of the code.

- **Native crypto over Tink library:** `crypto-core` uses Node.js built-in `crypto` module for AES-256-GCM. Tink for TypeScript is unmaintained. The envelope encryption pattern is identical.
- **Drizzle over TypeORM:** Type-safe queries, lighter footprint, better composability.
- **Yarn over pnpm:** `workspace:*` protocol, well-understood hoisting for CI caching.
- **Separate MAC keyset:** The audit HMAC key (`INSECURE-DEV-ONLY.mac.keyset.json`) is distinct from the encryption keyset to prevent keyset confusion.
