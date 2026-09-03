# Architecture Decision Records

## ADR-001: Node.js Native Crypto over Google Tink

**Status:** Accepted  
**Date:** 2026-04-11

**Context:**  
The initial design referenced `@google-cloud/tink-typescript` for envelope encryption. Investigation revealed:

- `@google-cloud/tink-typescript` does not exist as a published package
- `tink-crypto` (v0.1.1) is an unmaintained WASM port with no updates since 2022
- Tink's Java/Go/C++ implementations are mature, but the TypeScript ecosystem has no production-ready option

**Decision:**  
Use Node.js built-in `crypto` module to implement AES-256-GCM envelope encryption. The keyset JSON format mirrors Tink's concepts (keysetHandle, keyId, key status, key templates) for familiarity.

**Consequences:**

- Zero runtime dependencies in crypto-core — auditable, portable, fast
- Demonstrates deeper cryptographic understanding than wrapping a library
- Must manually implement: key rotation logic, DEK wrapping, AAD binding, memory zeroing
- Production deployments should integrate Cloud KMS for KEK unwrapping (keyset-loader already has the prod code path)

---

## ADR-002: Drizzle ORM over Prisma / TypeORM

**Status:** Accepted  
**Date:** 2026-04-11

**Context:**  
NestJS traditionally pairs with TypeORM or Prisma. Both have trade-offs:

- TypeORM: decorator-heavy, runtime schema, poor TypeScript inference
- Prisma: code generation step, binary engine dependency, limited raw SQL escape hatches

**Decision:**  
Use Drizzle ORM for type-safe, SQL-like query building with zero code generation.

**Consequences:**

- Schema defined in TypeScript (`src/db/schema.ts`) — single source of truth
- `drizzle-kit` handles migrations via `push` (dev) or `generate` + `migrate` (prod)
- SQL-like API is transparent — what you write is what executes
- Smaller community than Prisma, but growing rapidly

---

## ADR-003: Yarn 4 Workspaces over Nx / Turborepo

**Status:** Accepted  
**Date:** 2026-04-11

**Context:**  
Monorepo tooling options: Nx, Turborepo, Lerna, or native package manager workspaces. This is a reference project, not a 50-package enterprise monorepo.

**Decision:**  
Use Yarn 4 with native workspaces. No additional build orchestration layer.

**Consequences:**

- Zero additional tooling to learn or configure
- `workspace:*` protocol for internal dependencies
- Topological build order via `yarn workspaces foreach -At run build`
- If the project grows significantly, Turborepo can be layered on top without restructuring

---

## ADR-004: Separate Encryption and MAC Keysets

**Status:** Accepted  
**Date:** 2026-04-11

**Context:**  
A single keyset could be used for both AES-256-GCM encryption and HMAC-SHA-256 audit signing. This is a keyset confusion risk — using the same key material for different cryptographic purposes violates best practices (NIST SP 800-57).

**Decision:**  
Maintain two separate keysets:

- `INSECURE-DEV-ONLY.keyset.json` — encryption keys (AES-256-GCM)
- `INSECURE-DEV-ONLY.mac.keyset.json` — MAC keys (HMAC-SHA-256)

**Consequences:**

- Each keyset can rotate independently
- Cloud KMS maps to two separate crypto keys with different purposes (ENCRYPT_DECRYPT vs MAC)
- Slightly more configuration, but eliminates a class of cryptographic misuse

---

## ADR-005: RFC 7807 Problem Details for All Errors

**Status:** Accepted  
**Date:** 2026-04-11

**Context:**  
REST APIs commonly return ad-hoc error formats (`{ error: "...", message: "..." }`), making client-side error handling inconsistent.

**Decision:**  
All error responses use [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) `application/problem+json` format with `type`, `title`, `status`, `detail`, and optional `instance` (correlation ID) and `errors` (validation details).

**Consequences:**

- Single `HttpExceptionFilter` handles all error formatting
- Clients can rely on a consistent error contract
- Zod validation errors include per-field details in the `errors` array
- The `instance` field carries the X-Request-ID for support correlation

---

## ADR-006: Property-Based Testing for Tamper Detection

**Status:** Accepted  
**Date:** 2026-04-11

**Context:**  
Unit tests for audit chain verification can only test specific tamper scenarios the author imagines. A determined attacker might find mutations that pass verification.

**Decision:**  
Use `fast-check` for property-based testing: generate random audit chains (3-15 entries), mutate a random field at a random position, and assert verification always fails.

**Consequences:**

- 100 random scenarios per test run, covering mutations the author didn't explicitly imagine
- Tests are slower (~2s) but provide much stronger guarantees
- Complements (not replaces) explicit unit tests for specific scenarios

---

## ADR-007: Single-Root Terraform Until Repetition Earns Modules

**Status:** Accepted
**Date:** 2026-09-03

**Context:**
`infra/` is a single root configuration split by concern across seven files (`main`,
`variables`, `iam`, `kms`, `sql`, `logging`, `outputs`). It contains no `module` blocks and no
`modules/` directory. The obvious criticism is that "modular Terraform" is the accepted marker of
a mature IaC setup and this configuration does not have it.

That criticism assumes modules are free. They are not. A module is an interface, and an interface
has to be designed, versioned, documented, and kept stable for its callers. The payoff for that
cost is reuse. At one environment and one instance of every resource, there is no reuse, so the
cost is paid and nothing is collected. Premature modularization produces the worst outcome
available here: indirection that hides a 200-line configuration behind variable plumbing, making
it harder to read for the exact audience this repository is written for.

The counter-question worth answering precisely is _when does that stop being true_. Two triggers,
both concrete:

1. **A second environment.** The moment a `staging` needs to exist alongside `prod`, every
   resource here is instantiated twice, and the duplication is total. That is the trigger with
   the clearest economics.
2. **A second instance of a resource group inside one environment.** The two KMS crypto keys in
   `kms.tf` are the nearest thing already present: same key ring, same 90-day rotation, same HSM
   protection level, differing only in purpose and algorithm. Two is the threshold where a module
   starts to pay, and a third key would settle it.

Neither has fired yet.

**Decision:**
Keep `infra/` as a single root configuration, split by concern rather than by module. Extract
modules when one of the two triggers above actually occurs, driven by observed repetition rather
than by convention.

When extraction happens, the first move is an `envs/` split with `dev` and `prod` roots calling a
shared module, not a bottom-up decomposition of every resource type. The environment boundary is
where the duplication actually lives.

Related decisions made alongside this one:

- **Remote state, not local.** The GCS backend is declared as a partial configuration
  (`backend "gcs" {}`) with the bucket supplied at `terraform init -backend-config=`. A public
  reference repository cannot hardcode a real bucket name, and partial configuration is the
  correct answer to that rather than a comment telling the reader to uncomment something.
- **`.terraform.lock.hcl` is committed.** Pinning `required_providers` constrains the range;
  the lock file is what actually makes a plan reproducible across machines and CI.

**Consequences:**

- The configuration stays readable end to end, which matters more here than in a private repo,
  because being read _is_ this project's function.
- The module boundary is deferred, not avoided. Deferring it means it gets drawn against real
  duplication instead of guessed duplication, which is the only way to get the interface right on
  the first attempt.
- **Terraform state is sensitive and must be treated as such.** `google_sql_user.password` holds
  plaintext in state regardless of where the value comes from (see ADR-008), so the state bucket
  needs IAM at least as tight as the Secret Manager secret it protects. Local state would put
  that plaintext on a laptop, which is the real argument for the remote backend here — not
  collaboration.
- This ADR is the honest answer to "why isn't this modular," and it is a better answer than a
  `modules/` directory containing one caller.

---

## ADR-008: Generated Database Credential in Secret Manager

**Status:** Accepted
**Date:** 2026-09-03

**Context:**
`infra/sql.tf` previously created the application database user with a literal placeholder:

```hcl
password = "CHANGE_ME_IN_SECRET_MANAGER"
```

The comment named the correct fix while the code did not perform it, which is the worst of both
states. In a public repository whose entire subject is the handling of regulated data, a
hardcoded credential string is the first thing a security reader finds, and no automated gate in
this project catches it: `gitleaks` matches entropy and known provider patterns, and this string
has neither, while the Trivy job scans the built container image rather than the IaC.

**Decision:**
Generate the credential at apply time and store it in Secret Manager.

- `random_password.vault_app` generates a 32-character password. The special-character set is
  restricted to characters requiring no percent-encoding in the userinfo component of a
  `postgres://` URL, because the value is interpolated into `DATABASE_URL` at deploy time.
- `google_secret_manager_secret.vault_db_password` plus a version holds it.
- `google_sql_user.vault_app` consumes `random_password.vault_app.result` directly.
- `google_secret_manager_secret_iam_member.vault_api_db_password` grants the service account
  `roles/secretmanager.secretAccessor` **on that one secret**, not at project scope. This is the
  same reasoning as the per-key KMS bindings in `iam.tf`: the blast radius of a compromised
  service account should be the resources it needs, not every secret in the project.
- The `db_password_secret_id` output exposes the secret's resource name. The value is never an
  output.

**Consequences:**

- No credential in version control, and rotation is a `terraform taint` plus apply rather than a
  code change.
- The service account's permission surface grows by exactly one resource-scoped binding.
- **This does not make Terraform state safe.** `google_sql_user.password` lands in state in
  plaintext no matter where the value originates. Secret Manager removes the credential from the
  repository and gives the running service a rotatable read path; it does not remove it from
  state. Protecting state is a separate control and it belongs to the backend (see ADR-007).
  Claiming otherwise would be the more comfortable story and it would be wrong.
- Adds the `hashicorp/random` provider, pinned in `required_providers` and recorded in
  `.terraform.lock.hcl`.
