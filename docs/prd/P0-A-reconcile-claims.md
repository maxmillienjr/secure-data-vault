---
id: P0-A
title: Reconcile documented claims with the code at HEAD
tier: 0
status: draft
size: M
depends_on: []
blocks: [P5-A]
issue: null
superseded_by: null
---

# P0-A · Reconcile documented claims with the code at HEAD

## Problem

The documentation describes several things the code does not do. None of them is a matter
of docs lagging a release; each was written in the present tense on the day the code
landed, and the code never did it.

The inventory below was produced by reading every capability sentence in `README.md`,
`CLAUDE.md`, `AGENTS.md`, `.context/` and `.agents/`, then reading the source it
describes and, where the claim is about behaviour, running it. Line numbers are at
`65c144b`.

| #   | Claim                                                                                                                                | Documented at                                                                                        | Reality                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cloud KMS unwraps the KEK and supplies the HMAC key                                                                                  | `.context/architecture.md:34-35`; `packages/crypto-core/README.md:38-40`; ADR 0001, last consequence | `keyset-loader.ts:27-30` and `:51` throw `not yet implemented`. `README.md:222-226` already says so; the other three surfaces do not.                                                                                                                                         |
| 2   | crypto-core exports only `encrypt`, `decrypt`, the two loaders, types and errors; no raw key material; no "internal Tink primitives" | `CLAUDE.md:21`                                                                                       | `packages/crypto-core/src/index.ts:3-4` also exports `resetDevWarning`, `deserializeKeyset`, `getPrimaryKey`, `getKeyById`; `getPrimaryKey` returns raw `keyMaterial` (`types.ts:38`). There are no Tink primitives; ADR 0001 removed Tink before crypto-core's first commit. |
| 3   | The DEK is zeroed "in a `finally` block"                                                                                             | `README.md:105`; `.context/threat-model.md:26`; `.agents/security-reviewer.md:20`                    | No `finally` in `encrypt.ts` or `decrypt.ts`. Zeroing at `encrypt.ts:55` and `decrypt.ts:63,67`; an exception between `randomBytes` and `dek.fill(0)` in `encrypt` leaves the DEK unzeroed.                                                                                   |
| 4   | Zod validation on "all request bodies, queries, and params"                                                                          | `.context/threat-model.md:30`; `.context/architecture.md:47`                                         | `@ZodParam` is applied to zero handlers. `GET /api/v1/records/not-a-uuid` returns a 500 problem document (observed 2026-09-15).                                                                                                                                               |
| 5   | The audit row is inserted, then updated with hash and signature; "no UPDATE or DELETE except hash/signature backfill"                | `.context/architecture.md:76-79`; `.agents/security-reviewer.md:27`                                  | One `INSERT` carrying hash and signature (`drizzle-audit-storage.adapter.ts:38-52`) since `6663d4b`. No backfill path exists.                                                                                                                                                 |
| 6   | All three packages have zero runtime dependencies                                                                                    | `.context/architecture.md:86-97`; `README.md:179-181`                                                | shared-types depends on `zod` (`packages/shared-types/package.json:19-21`).                                                                                                                                                                                                   |
| 7   | The admin console depends on shared-types                                                                                            | `.context/architecture.md:94`                                                                        | No workspace dependency (`apps/admin-console/package.json:12-23`); the types are redeclared in `api.service.ts:7-47`.                                                                                                                                                         |
| 8   | E2E tests "use a real in-memory database"                                                                                            | `.agents/test-author.md:42`                                                                          | Postgres 16 in a service container (`e2e.yml:16-29`).                                                                                                                                                                                                                         |
| 9   | `.context/` holds the ADRs                                                                                                           | `README.md:187`                                                                                      | The records moved to `docs/adr/`; `.context/decisions.md` is a pointer.                                                                                                                                                                                                       |
| 10  | "CI validates with `-backend=false`"                                                                                                 | `infra/main.tf:28`                                                                                   | No workflow runs `terraform`.                                                                                                                                                                                                                                                 |
| 11  | Production migrations via `drizzle-kit generate` + `migrate`                                                                         | ADR 0002, second consequence; `.agents/migration-author.md:28`                                       | No migrations directory is tracked; the production image runs `drizzle-kit push` at startup (`entrypoint.sh:5`).                                                                                                                                                              |
| 12  | Deleted audit rows are detected                                                                                                      | `README.md:89`                                                                                       | Interior deletions are. A chain with its tail removed verifies `full` (probed 2026-09-15).                                                                                                                                                                                    |
| 13  | Threat rows T-04, T-08, T-11 and T-12 are `Done`                                                                                     | `.context/threat-model.md:22,26,29,30`                                                               | T-08 and T-12 are rows 3 and 4 above. T-04 ("sequence gap detection") is row 12 above: tail deletions are undetected. T-11 is `Done` on a rate limit no test or probe has made fire (`docs/STATUS.md` row 20).                                                                |
| 14  | Packages are tested with Vitest                                                                                                      | `AGENTS.md:23`                                                                                       | Every workspace uses Jest with `ts-jest` (`.context/conventions.md:30-36`); `git grep -ri vitest -- . ':!yarn.lock'` matches this line and one Dependabot comment, and no `vitest` dependency or config exists.                                                               |

Four facts about the gates belong with the inventory, because a gate that does not run is a
claim in the same sense:

- `yarn format:check` is a root script, is in no workflow, and exited 1 on `main` at
  `65c144b` for three files. This branch's first commit (`1809b48`) reformats them; the
  step is still absent from `ci.yml`.
- The surfaces disagree on the Node major. `README.md:117` says 24+; `ci.yml:17`,
  `e2e.yml:36`, `security.yml:40` and `release.yml:24` say 24; `apps/admin-console/Dockerfile:2`
  is `node:24-alpine`; `apps/vault-api/Dockerfile:2,27` has been `node:26-alpine` since
  `dac184d`, a Dependabot bump that then needed `58002d4` to install corepack by hand
  because `node:26-alpine` ships without it.
- `release.yml:65` gates the SBOM upload on `steps.semantic-release.outcome`; the
  semantic-release step at `release.yml:35-38` has no `id`, so the condition is never true.
- The e2e suite is not re-runnable. `records.e2e-spec.ts:35` and `audit.e2e-spec.ts:33`
  insert fixed unique emails; the second run against the same database fails 6/7 with 500s.
  Observed 2026-09-15: 7/7 on a fresh volume, 6/7 four minutes later on the same one.

## Why it matters

A reference architecture for regulated data is read by people who check. Under the HIPAA
Security Rule and SOC 2, a control that is documented and does not operate as documented is
not a partial credit; it is the finding. OWASP ASVS V1 asks that the documented architecture
be the implemented one. Every row above is a place where a reader who believes the document
and then opens the file learns not to believe the document, and that costs the accurate
sentences their credibility along with the inaccurate ones. Closing the gap does not require
building the fourteen things. It requires that every sentence be true on the day it is read,
and the cheap way to make a sentence true is usually to delete it.

## Scope

For each inventory row: either make the claim true or delete it. The default is **delete or
restate**; implementation is what Tiers 1–5 are for, and this PRD is deliberately the cheap
half. A claim that survives as forward-looking names the PRD that will make it present
tense.

- Rewrite the false or overstated sentences in `README.md`, `CLAUDE.md`,
  `.context/architecture.md`, `.context/threat-model.md`, `.agents/security-reviewer.md`,
  `.agents/test-author.md`, `.agents/migration-author.md`, `AGENTS.md`,
  `packages/crypto-core/README.md` and `infra/main.tf`.
- Move the matching `docs/STATUS.md` rows (3, 7, 8, 26, 27, 31, 32, 33, 37) in the same
  pull request, each with evidence that resolves.
- Pin one Node major across `README.md`, the four workflows and both Dockerfiles, and
  re-enable the Node-major check in `scripts/lint-docs.mjs`.
- Add `yarn format:check` to `ci.yml`.
- Make `release.yml` say what it does: give the semantic-release step
  `id: semantic-release`, or remove the conditional upload step.
- Make `infra/main.tf:28` true with a `terraform init -backend=false && terraform validate`
  job, or delete the sentence.
- Make the e2e suite re-runnable: per-run unique emails, or a truncate in `beforeAll`.
- Point `README.md:187` at `docs/adr/`.

### Non-goals

- Implementing any inventory row. Row 1 is P1-A; row 4 is P5-B; row 5 needs only the prose
  fix; row 11 is P2-D; row 12 is P2-B. The console list (STATUS row 28) is P5-C.
- Deciding what `semantic-release` should do. Making the workflow's steps refer to steps
  that exist is here; whether the release pipeline is configured or removed is P5-D.
- Restructuring the threat model. Only the T-04, T-08, T-11 and T-12 cells and their
  `Status` change; T-04 follows row 12's resolution and T-11 becomes whatever row 20 becomes.
- Adding a `finally` to `crypto-core`. That is a code change to the cryptographic core and
  goes through `.agents/security-reviewer.md`; this PRD accepts either resolution of row 3
  and requires the STATUS row to say which.

## Design

**Wording discipline.** The README may describe the architecture in the present tense, but a
capability that is not wired must not be. "Master keys are managed by Cloud KMS" becomes
"the Terraform under `infra/` provisions the KMS keys the service will use once P1-A lands",
or better, the sentence moves to `docs/STATUS.md` as a `planned` row and the README links
it.

**Where the truth goes.** `docs/STATUS.md` is the load-bearing artifact. A matrix a reader
can check against the code in a minute is worth more than prose that reads well, and it is
the file this PRD leaves behind for future sessions to keep current.

**Node major.** The recommendation is 24: four workflows and the console image already say
so, Node 24 is the line the workflows have been tested on, and moving `apps/vault-api/Dockerfile`
back to it removes the corepack workaround from `58002d4` rather than adding one to the
console. The alternative is 26 everywhere, which is a runtime upgrade for the whole
pipeline and belongs in its own change with its own test run. Either way the check in
`scripts/lint-docs.mjs` comes back and pins the answer.

**Order of work.** Prose first, one commit per file, because each is independently
reviewable and none can break a build. Then the gates, one commit each, because each can.

## Acceptance criteria

- [ ] Each of inventory rows 1–14 is either true of the code at HEAD or restated as
      forward-looking with a PRD id, verified by re-reading the cited lines.
- [ ] `git grep -n -i tink -- README.md CLAUDE.md AGENTS.md .agents .context/architecture.md
.context/threat-model.md packages/crypto-core/src` returns zero hits; the history of
      the decision lives in ADR 0001 and nowhere else. The word survives only as the ADR's
      filename, which `.context/decisions.md`, `docs/adr/README.md` and `docs/STATUS.md`
      link — a broader pathspec can never reach zero and is not the criterion.
- [ ] `git grep -n finally -- README.md .context/threat-model.md
.agents/security-reviewer.md` returns zero hits, or `encrypt.ts` and `decrypt.ts`
      each contain a `finally` that zeroes the DEK and `docs/STATUS.md` row 3 says so.
      `.agents/prd-author.md` and `.context/conventions.md` cite this claim as the worked
      example of prose drift and keep their hits under either resolution.
- [ ] `git grep -n -i "in-memory database" -- .agents` returns zero hits, and
      `AGENTS.md` names Jest for every workspace.
- [ ] One Node major appears in `README.md`, all four workflows and both Dockerfiles, and
      the Node-major check in `scripts/lint-docs.mjs` is enabled and passes.
- [ ] `ci.yml` runs `yarn format:check` and the job is green on this branch.
- [ ] Every `steps.<id>.outcome` reference in `release.yml` names a step that declares that
      `id`, or the referencing step is gone.
- [ ] `infra/main.tf:28` is true: a workflow runs `terraform init -backend=false` and
      `terraform validate`, or the comment is deleted.
- [ ] `yarn workspace @secure-data-vault/vault-api test:e2e` passes twice in a row against
      the same database.
- [ ] `README.md:187` names `docs/adr/`.
- [ ] `docs/STATUS.md` rows 3, 7, 8, 26, 27, 31, 32, 33 and 37 are updated in the same pull
      request, and `yarn lint:docs` resolves every citation.
- [ ] `yarn typecheck`, `yarn lint`, `yarn test`, `yarn lint:docs` and `yarn format:check`
      pass.

## Risks and open questions

- **The honest README is a less impressive README.** That is the correct trade. A
  calibrated claim survives a code read; an inflated one does not, and this repository is
  read by people who will check.
- **Node 24 or 26 is the owner's call.** The PRD recommends 24 and says why; a reviewer who
  wants 26 should say so before implementation starts, because the Dockerfile change and
  the lint check both follow from it.
- **Rows may have moved by the time this is implemented.** Re-verify every cited line
  before acting on it; another PRD may have closed a row or a Dependabot bump may have
  shifted a line number. `yarn lint:docs` catches the second, not the first.
- **Row 3 has two honest resolutions and they differ in kind.** Deleting three words is a
  docs change; adding a `finally` is a crypto-core change. The PRD leaves the choice to the
  implementer and requires the STATUS row to record it.
- **`semantic-release` with no configuration may be doing nothing, or something
  surprising.** Nobody in this repository has read its run logs. P5-D owns finding out; this
  PRD only stops the workflow from referring to a step that does not exist.

## References

- `docs/STATUS.md`, rows 3, 5, 7, 8, 12, 17, 26, 27, 29, 31, 32, 33, 34 and 37.
- HIPAA Security Rule, 45 CFR §164.312; AICPA Trust Services Criteria CC6 and CC7; OWASP
  ASVS 4.0, V1 Architecture, Design and Threat Modeling.
- The original build specification at `aa035c4:PRD.md`, §13, whose acceptance criteria 6,
  10 and 11 this inventory partly re-derives.
