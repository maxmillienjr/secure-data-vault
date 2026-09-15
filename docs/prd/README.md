# Product Requirement Docs

## Where things stand

_Last updated 2026-09-15, verified against `main` at `65c144b`. If this section is more than
a few weeks stale, trust the code over it and update it._

**The service runs and its gates are green.** On 2026-09-15 at `65c144b`: `yarn install
--immutable`, `yarn build:packages`, `yarn typecheck`, `yarn lint`, `yarn test` and
`yarn build` all exited 0. `yarn test` is 36 unit tests — 14 in crypto-core, 14 in
audit-core, 8 in vault-api — and shared-types and the console declare none. The e2e suite
passed 7/7 against a fresh Postgres 16 from `docker-compose.yml`, and failed 6/7 when run a
second time against the same database, because two specs insert fixed unique emails.
`terraform init -backend=false && terraform validate` passed. `yarn format:check` exited 1
on three source files and is not a CI step; the three files are fixed in this branch's first
commit, and the step is still absent.

**`docs/STATUS.md` is the authority on any capability sentence, including the ones above.**
Thirty-nine rows, each with a status, a file and a line — sixteen `implemented`, three
`stubbed`, six `planned`, eleven `broken`, three `unverified`, none `removed`. The rule that
keeps it true is in `.context/conventions.md`: a change that moves a row moves it there in
the same pull request. `yarn lint:docs` fails CI when a citation no longer resolves or a
PRD's status disagrees with its index row.

**The primitives are real; the production story is prose.** Envelope encryption with AAD
binding, a hash chain with HMAC signatures, RFC 7807 on every error and optimistic
concurrency are wired and tested. The key-encryption key is a JSON file that the release
image copies into itself and pushes to GHCR; `CRYPTO_CORE_MODE=prod` throws at startup;
Cloud KMS appears in Terraform and in two diagrams and on no code path. The audit chain
proves internal consistency and nothing more: a slice verified with `?from=2` reports
`failed` on an intact chain, a truncated tail reports `full`, the audit write is best-effort
and outside the mutation's transaction, and every entry names the nil UUID as its actor
because nothing authenticates. The console's records page calls `GET /api/v1/records`, which
the API does not serve. Each of those sentences is a STATUS row with a file and a line.

**Nothing has shipped from this backlog yet.** Every PRD is `draft`. P0-A is the one to
read first: it is the inventory of what the documentation says that the code does not do,
and it is cheap, because the default resolution is to delete the claim. P1-A is the thesis
— a `KeyProvider` seam with a Cloud KMS implementation behind it — and it is `L` because
the path it replaces has never executed, so the defects behind it are unknown in number.

**Where this came from.** The original build specification lived at `PRD.md` in commit
`aa035c4` and was removed from the tree before the first package landed; this index
supersedes it. Its out-of-scope table, the acceptance criteria it set that the code never
met — tamper detection end to end, a console that lists records, a release that attaches
its SBOM — and the behaviour it specified that was never built seeded Tiers 1 through 5.

## How this works

- **This index is the source of truth for the backlog.** Every planned change lives here,
  whether or not it has a GitHub issue.
- **GitHub issues are the tracking layer, not the content layer.** An issue is opened only
  when work on a PRD actually starts; its body is a link plus acceptance criteria. This
  keeps the tracker a picture of momentum rather than a pile of stale intentions.
- **Tiers map to milestones.** They are thematic, not time-boxed.
- **Sub-issues decompose a PRD into tasks** — never a tier into PRDs. Tier→PRD is a
  taxonomy and lives here; PRD→task is a work breakdown and lives in GitHub.
- **An id with a row and no file is a backlog entry, not a spec.** `/prd <id>` drafts the
  file when the work is next; until then the row is the whole record.
- **Changes arrive as pull requests.** `git log -p docs/prd/<file>` is the record of how the
  thinking changed, which is the whole reason these are files and not issue bodies.

Status values: `draft` → `accepted` → `in-progress` → `shipped` → `superseded`.
Sizes: `S` ≈ 1–2 days, `M` ≈ 3–5 days, `L` ≈ 1–2 weeks.

## Tier 0 — Truth alignment

The prose describes a KMS edge whose code path throws, a `finally` block that no source file
contains, a validation guarantee that covers two of the three inputs it names, a
zero-dependency package that depends on `zod`, and a console page that calls a route the API
does not serve. Twenty-three of thirty-nine STATUS rows are something other than
`implemented`. Nothing in this tier builds a capability. It makes every present-tense
sentence true of the code at HEAD, pins the one Node major the surfaces disagree on, and
puts the gates that were missing — `format:check`, `terraform validate`, a re-runnable e2e
suite — where a regression cannot hide behind them again.

| ID                               | Title                                             | Size | Status |
| -------------------------------- | ------------------------------------------------- | ---- | ------ |
| [P0-A](P0-A-reconcile-claims.md) | Reconcile documented claims with the code at HEAD | M    | draft  |

## Tier 1 — Key management realism

The thesis is envelope encryption, and the value of envelope encryption is where the
key-encryption key lives. Today it lives in `INSECURE-DEV-ONLY.keyset.json`, which the
production image copies into itself and the release workflow publishes; `CRYPTO_CORE_MODE=prod`
cannot start; the Terraform key ring, the HSM keys and the IAM bindings are provisioned for a
caller that does not exist. NIST SP 800-57 puts the weight of a key hierarchy on the
protection of its wrapping keys, and this one has none. P1-A is the tier's spine: a
`KeyProvider` seam in crypto-core, a Cloud KMS implementation in the app so the package stays
dependency-free, and an in-process fake so the same suite runs on both axes. Rotation, MAC
key identifiers and fail-closed loading follow from it.

| ID                               | Title                                                                    | Size | Status |
| -------------------------------- | ------------------------------------------------------------------------ | ---- | ------ |
| [P1-A](P1-A-kms-key-provider.md) | KMS-backed key encryption behind a `KeyProvider` seam                    | L    | draft  |
| P1-B                             | KEK rotation drill and DEK re-wrap, exercised end to end                 | M    | draft  |
| P1-C                             | Key-id-tagged audit signatures and MAC key rotation                      | S    | draft  |
| P1-D                             | Fail-closed production keyset loading; no keysets in the published image | S    | draft  |

## Tier 2 — Audit integrity

A hash chain proves that the rows you were shown are consistent with each other. It does
not prove they are all the rows, that they were written when the mutation happened, or that
nobody with a database connection can rewrite them. At HEAD, verification of a slice fails on
an intact chain, a truncated tail verifies `full`, the audit append runs after the handler in
its own transaction and its failure is logged and swallowed, and append-only is a comment in
`schema.ts` that no `GRANT` enforces. HIPAA §164.312(b) asks for audit controls that record
and examine activity; SOC 2 CC7 asks that the record be complete. This tier moves the log
from tamper-evident in a unit test to tamper-evident in the terms an auditor uses: anchored
heads, atomic appends, database-enforced immutability, and an export someone else can check.

| ID   | Title                                                              | Size | Status |
| ---- | ------------------------------------------------------------------ | ---- | ------ |
| P2-A | Anchor-aware range verification for `/audit/verify`                | S    | draft  |
| P2-B | Chain-head anchoring against an external witness                   | M    | draft  |
| P2-C | Audit append atomic with the mutation it records                   | M    | draft  |
| P2-D | Database-enforced append-only `audit_log` and generated migrations | M    | draft  |
| P2-E | Signed, independently verifiable audit export                      | S    | draft  |

## Tier 3 — Identity and tenant isolation

Every audit row names `00000000-0000-0000-0000-000000000000` as its actor because nothing
authenticates a request. A record is readable by anyone who knows its id regardless of tenant,
so the AAD binding stops a ciphertext from being moved between tenants but not from being read
across them. The threat model lists authentication as per-deployment and out of scope; the
audit log's actor field and the tenant column both assume it exists. Identity comes first,
then tenant scoping enforced where the data lives — Postgres row-level security, not a
`WHERE` clause a future handler can forget — and then the two things a tenant key hierarchy
makes possible: erasure by key destruction, which HIPAA and GDPR both accept as disposal, and
equality search over fields that never leave ciphertext.

| ID   | Title                                                      | Size | Status |
| ---- | ---------------------------------------------------------- | ---- | ------ |
| P3-A | Bearer identity at the boundary and real actor attribution | M    | draft  |
| P3-B | Tenant-scoped access and Postgres row-level security       | M    | draft  |
| P3-C | Crypto-shredding through a per-tenant key hierarchy        | L    | draft  |
| P3-D | Blind-index search over encrypted fields                   | L    | draft  |

## Tier 4 — Compliance and observability as code

The threat model marks fifteen mitigations `Done` and maps none of them to the controls a
reviewer audits against, so a reader has to do that translation by hand. Three of the
fifteen are contradicted by the code — T-04, T-08 and T-12, which are `docs/STATUS.md`
rows 10, 3 and 17 — and a fourth, T-11, is `Done` on a rate limit nobody has observed fire
(row 20). The structured logger exists and is never
constructed; requests are logged as JSON strings inside Nest's default format, and no span
connects a mutation to the audit row it produced. This tier makes the compliance story a
file a CI job can check — every threat row mapped to HIPAA Security Rule §164.312, SOC 2 CC6
and OWASP ASVS, and a build that fails on an unmapped control — and makes the runtime
observable in the vocabulary those frameworks expect.

| ID   | Title                                                                                         | Size | Status |
| ---- | --------------------------------------------------------------------------------------------- | ---- | ------ |
| P4-A | `governance/controls.yaml` mapping the threat model to HIPAA, SOC 2 and ASVS, with a CI check | M    | draft  |
| P4-B | Structured logging wired in, and OpenTelemetry traces with audit-event semantics              | M    | draft  |

## Tier 5 — Verification depth and supply chain

Thirty-six unit tests and seven e2e tests, none of which flips a stored byte, validates a
response body, exercises a rate limit, or opens the console. Tamper detection is proven
against an in-memory array. The release job builds an SBOM and never attaches it, and the
image it publishes carries the dev keysets. This tier is the evidence that the earlier tiers
did what they say: negative tests written from the threat table and run against Postgres,
service specs for every handler, a console that is tested in a browser, and a release whose
artifacts a consumer can verify under SLSA.

| ID   | Title                                                                             | Size | Status |
| ---- | --------------------------------------------------------------------------------- | ---- | ------ |
| P5-A | Threat-model-driven negative tests at the database layer                          | M    | draft  |
| P5-B | Service specs, and response validation applied to every handler                   | M    | draft  |
| P5-C | Admin console: a records list that exists, security headers, Playwright           | M    | draft  |
| P5-D | Release integrity: SBOM attached, SLSA provenance, IaC and HIGH-severity scanning | M    | draft  |

## Sequencing

The dependency spine, not a schedule:

```
P0-A ──▶ P5-A

P1-A ──┬──▶ P1-B
       ├──▶ P1-D
       └──▶ P3-C ◀── P3-B ◀── P3-A
                      ├──▶ P3-D
                      └──▶ P5-C

P2-A ──▶ P2-B ──▶ P2-E
```

P5-A waits on P0-A only for the re-runnable e2e suite; a negative test that has to be run
against a fresh database every time is a test nobody runs twice. P1-B, P1-D and P3-C need
the `KeyProvider` seam before a second key, a fail-closed loader or a per-tenant hierarchy
has anywhere to live. P3-B needs an authenticated caller to scope by, and P3-D and P5-C need
a tenant-scoped list to search and to render. P2-B builds on P2-A's notion of an anchor, and
P2-E signs the head P2-B anchors.

`P1-C`, `P2-C`, `P2-D`, `P4-A`, `P4-B`, `P5-B` and `P5-D` have no hard predecessors and can
be picked up whenever they are the most valuable next thing.
