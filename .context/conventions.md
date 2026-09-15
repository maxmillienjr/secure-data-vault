# Conventions

Everything in this file is true of the tree at HEAD. If a sentence here stops being true,
fix the sentence or the code in the same change; do not leave it to be discovered.

## Commits

- **Conventional Commits.** The history uses `feat:`, `fix:`, `chore:`, `ci:`, `docs:`,
  `test:`, `refactor:`, `security:` and `infra:`, with a workspace scope in parentheses when
  one workspace is touched (`fix(vault-api): …`, `feat(admin-console): …`).
- Imperative mood, lowercase first word after the prefix.
- Small commits. A change that touches a schema, an adapter and a test is three commits.

## Gates

- Run `yarn typecheck`, `yarn lint`, `yarn test`, `yarn lint:docs` and `yarn format:check`
  before declaring any task complete.
- `yarn build:packages` comes first on a clean checkout: the apps typecheck against the
  packages' `dist/` output, which is why `ci.yml` builds packages before it typechecks.
- `ci.yml` runs install, `build:packages`, `lint`, `typecheck`, `test`, `lint:docs` and
  `build`. `format:check` is not a CI step yet; P0-A owns adding it.
- The e2e suite is `yarn workspace @secure-data-vault/vault-api test:e2e` against a real
  Postgres 16: `docker compose up -d --wait postgres`, then the workspace's `db:push`, then
  `test:e2e`. It needs a **fresh database**: two specs insert fixed unique emails, so a
  second run against the same database fails 6 of 7 with 500s. P0-A owns making it
  re-runnable.

## Testing

| Location                | Framework        | Command                                                | Pattern              |
| ----------------------- | ---------------- | ------------------------------------------------------ | -------------------- |
| `packages/crypto-core/` | Jest + ts-jest   | `yarn test`                                            | `test/*.spec.ts`     |
| `packages/audit-core/`  | Jest + ts-jest   | `yarn test`                                            | `test/*.spec.ts`     |
| `apps/vault-api/` unit  | Jest + ts-jest   | `yarn test`                                            | `src/**/*.spec.ts`   |
| `apps/vault-api/` e2e   | Jest + supertest | `yarn workspace @secure-data-vault/vault-api test:e2e` | `test/*.e2e-spec.ts` |
| Property-based          | fast-check       | `yarn test`                                            | `*.property.spec.ts` |

`packages/shared-types` and `apps/admin-console` declare no tests; their `test` scripts
exit 0 after printing so.

- **Two axes, name the one you verified on.** The dev keyset and a KMS key are one pair;
  `InMemoryAuditStorage` and the Drizzle adapter on Postgres are the other. Tamper detection
  is proven against the in-memory adapter only. A criterion verified on the fake is not
  verified on the real one.

## Documentation

- **Planned work goes in `docs/prd/`**, one file per PRD, indexed by `docs/prd/README.md`.
  An id in the index with no file is a backlog row; a file is a spec.
- **Decisions go in `docs/adr/`.** A record is not edited after it reaches `accepted` —
  supersede it with a new one instead. `.context/decisions.md` is a pointer, not a copy.
- `yarn lint:docs` checks the structure: frontmatter completeness, that every id resolves,
  that `depends_on` and `blocks` are mutual, that the index agrees with the files, that a
  `shipped` PRD's unmet criteria each name the PRD that now owns them, that the ADR index
  and the ADR files agree, and that every `path:NN` citation in `docs/STATUS.md` names a
  tracked file with at least that many lines. It runs on every push and pull request.
- **A capability claim in `README.md`, `.context/`, or `.agents/` must be true of the code
  at HEAD.** `.agents/` counts: the `finally` block that no source file has lives in
  `.agents/security-reviewer.md` as a review checklist item. If it is aspirational, it
  belongs in `docs/prd/` or in the status matrix, not in the present tense.
- **`docs/STATUS.md` is that status matrix**, one row per documented capability with what
  is actually behind it and which PRD owns the rest. A change that moves a row — wiring the
  KMS provider, deleting a claim, fixing the console's list call — updates the row in the
  same pull request, with evidence that resolves.
- **Anything the matrix's author could not run is `unverified`**, never `implemented`. The
  row says what would verify it.
