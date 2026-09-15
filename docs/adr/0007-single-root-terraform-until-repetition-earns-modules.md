# 0007 · Single-root Terraform until repetition earns modules

**Status:** accepted
**Date:** 2026-09-03

## Context

`infra/` is a single root configuration split by concern across seven files (`main`,
`variables`, `iam`, `kms`, `sql`, `logging`, `outputs`). It contains no `module` blocks and
no `modules/` directory. The obvious criticism is that "modular Terraform" is the accepted
marker of a mature IaC setup and this configuration does not have it.

That criticism assumes modules are free. They are not. A module is an interface, and an
interface has to be designed, versioned, documented, and kept stable for its callers. The
payoff for that cost is reuse. At one environment and one instance of every resource, there
is no reuse, so the cost is paid and nothing is collected. Premature modularization produces
the worst outcome available here: indirection that hides a 200-line configuration behind
variable plumbing, making it harder to read for the exact audience this repository is
written for.

The counter-question worth answering precisely is _when does that stop being true_. Two
triggers, both concrete:

1. **A second environment.** The moment a `staging` needs to exist alongside `prod`, every
   resource here is instantiated twice, and the duplication is total. That is the trigger
   with the clearest economics.
2. **A second instance of a resource group inside one environment.** The two KMS crypto keys
   in `kms.tf` are the nearest thing already present: same key ring, same 90-day rotation,
   same HSM protection level, differing only in purpose and algorithm. Two is the threshold
   where a module starts to pay, and a third key would settle it.

Neither has fired yet.

## Decision

Keep `infra/` as a single root configuration, split by concern rather than by module.
Extract modules when one of the two triggers above actually occurs, driven by observed
repetition rather than by convention.

When extraction happens, the first move is an `envs/` split with `dev` and `prod` roots
calling a shared module, not a bottom-up decomposition of every resource type. The
environment boundary is where the duplication actually lives.

Related decisions made alongside this one:

- **Remote state, not local.** The GCS backend is declared as a partial configuration
  (`backend "gcs" {}`) with the bucket supplied at `terraform init -backend-config=`. A
  public reference repository cannot hardcode a real bucket name, and partial configuration
  is the correct answer to that rather than a comment telling the reader to uncomment
  something.
- **`.terraform.lock.hcl` is committed.** Pinning `required_providers` constrains the range;
  the lock file is what actually makes a plan reproducible across machines and CI.

## Consequences

- The configuration stays readable end to end, which matters more here than in a private
  repo, because being read _is_ this project's function.
- The module boundary is deferred, not avoided. Deferring it means it gets drawn against
  real duplication instead of guessed duplication, which is the only way to get the
  interface right on the first attempt.
- **Terraform state is sensitive and must be treated as such.** `google_sql_user.password`
  holds plaintext in state regardless of where the value comes from (see
  [0008](0008-generated-database-credential-in-secret-manager.md)), so the state bucket
  needs IAM at least as tight as the Secret Manager secret it protects. Local state would
  put that plaintext on a laptop, which is the real argument for the remote backend here —
  not collaboration.
- This record is the honest answer to "why isn't this modular," and it is a better answer
  than a `modules/` directory containing one caller.
