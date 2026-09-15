# Agent Registry

This file defines specialized agents for the Secure Data Vault project. Each agent has a focused responsibility and routing rules that determine when it should be invoked.

---

## Security Reviewer

- **File:** `.agents/security-reviewer.md`
- **Trigger:** Any PR or change touching `packages/crypto-core/`, `packages/audit-core/`, `src/crypto/`, `src/audit/`, keyset files, or Terraform IAM/KMS resources.
- **Purpose:** Validates cryptographic correctness, key management hygiene, and least-privilege IAM bindings.

## Migration Author

- **File:** `.agents/migration-author.md`
- **Trigger:** When schema changes are needed in `src/db/schema.ts` or a new Drizzle migration is requested.
- **Purpose:** Generates safe, reversible Drizzle migrations with proper column defaults, index considerations, and backward compatibility.

## Test Author

- **File:** `.agents/test-author.md`
- **Trigger:** When new features are added or existing tests need expansion.
- **Purpose:** Writes unit, integration, and property-based tests following the project's existing patterns (Vitest for packages, Jest for NestJS).

## PRD Author

- **File:** `.agents/prd-author.md`
- **Trigger:** Writing or revising a PRD in `docs/prd/`, or turning a backlog row in `docs/prd/README.md` into a file.
- **Purpose:** Produces specs whose every claim about this repository carries file:line evidence, whose acceptance criteria are checkable, and whose non-goals name the PRD that picks them up.

---

## Routing Rules

1. **Crypto/Audit changes** → Security Reviewer first, then standard review.
2. **Schema changes** → Migration Author generates migration, Security Reviewer checks for data exposure risks.
3. **New endpoints** → Test Author generates controller specs and E2E tests.
4. **Infrastructure changes** → Security Reviewer validates IAM and network policies.
5. **New or revised PRD** → PRD Author drafts; if the PRD touches crypto-core, audit-core, keysets or `infra/`, Security Reviewer reads the Design section before the status moves to `accepted`.

---

## Context Files

Read before starting work:

- `.context/architecture.md` — system diagram, request pipeline, data flow, schema
- `.context/threat-model.md` — assets, STRIDE table, trust boundaries, out of scope
- `.context/conventions.md` — commits, gates, testing map, documentation rules
- `docs/STATUS.md` — one row per documented capability, with what is actually behind it at HEAD
- `docs/prd/README.md` — the backlog index; what is planned and what it depends on
- `docs/adr/` — decisions that must not be silently contradicted (`.context/decisions.md` points here)

## Planned Work

- `docs/prd/README.md` is the backlog. Every planned change is described there before it is built. Read it before proposing new work; the thing you are about to suggest may already be a PRD with a decided approach.
- `docs/adr/` holds the architecture decision records. Do not contradict an accepted record without superseding it.
- `yarn lint:docs` checks the structure of all three — index, PRD files, ADR index, STATUS citations — and runs in CI.

Claude Code has a `/prd <id>` command (`.claude/commands/prd.md`) that runs the whole flow — implement if the PRD exists and is accepted, review if it is a draft, draft it if the id is in the index but the file is not. Other tools should follow the same three modes by hand, using `.agents/prd-author.md` for the rules.
