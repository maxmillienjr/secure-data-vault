# 0008 · Generated database credential in Secret Manager

**Status:** accepted
**Date:** 2026-09-03

## Context

`infra/sql.tf` previously created the application database user with a literal placeholder:

```hcl
password = "CHANGE_ME_IN_SECRET_MANAGER"
```

The comment named the correct fix while the code did not perform it, which is the worst of
both states. In a public repository whose entire subject is the handling of regulated data,
a hardcoded credential string is the first thing a security reader finds, and no automated
gate in this project catches it: `gitleaks` matches entropy and known provider patterns,
and this string has neither, while the Trivy job scans the built container image rather
than the IaC.

## Decision

Generate the credential at apply time and store it in Secret Manager.

- `random_password.vault_app` generates a 32-character password. The special-character set
  is restricted to characters requiring no percent-encoding in the userinfo component of a
  `postgres://` URL, because the value is interpolated into `DATABASE_URL` at deploy time.
- `google_secret_manager_secret.vault_db_password` plus a version holds it.
- `google_sql_user.vault_app` consumes `random_password.vault_app.result` directly.
- `google_secret_manager_secret_iam_member.vault_api_db_password` grants the service
  account `roles/secretmanager.secretAccessor` **on that one secret**, not at project
  scope. This is the same reasoning as the per-key KMS bindings in `iam.tf`: the blast
  radius of a compromised service account should be the resources it needs, not every
  secret in the project.
- The `db_password_secret_id` output exposes the secret's resource name. The value is never
  an output.

## Consequences

- No credential in version control, and rotation is a `terraform taint` plus apply rather
  than a code change.
- The service account's permission surface grows by exactly one resource-scoped binding.
- **This does not make Terraform state safe.** `google_sql_user.password` lands in state in
  plaintext no matter where the value originates. Secret Manager removes the credential
  from the repository and gives the running service a rotatable read path; it does not
  remove it from state. Protecting state is a separate control and it belongs to the
  backend (see [0007](0007-single-root-terraform-until-repetition-earns-modules.md)).
  Claiming otherwise would be the more comfortable story and it would be wrong.
- Adds the `hashicorp/random` provider, pinned in `required_providers` and recorded in
  `.terraform.lock.hcl`.
