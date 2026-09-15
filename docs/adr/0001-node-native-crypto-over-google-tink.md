# 0001 · Node.js native crypto over Google Tink

**Status:** accepted
**Date:** 2026-04-11

## Context

The initial design referenced `@google-cloud/tink-typescript` for envelope encryption.
Investigation revealed:

- `@google-cloud/tink-typescript` does not exist as a published package.
- `tink-crypto` (v0.1.1) is an unmaintained WASM port with no updates since 2022.
- Tink's Java, Go and C++ implementations are mature, but the TypeScript ecosystem has no
  production-ready option.

## Decision

Use the Node.js built-in `crypto` module to implement AES-256-GCM envelope encryption. The
keyset JSON format mirrors Tink's concepts (keyset handle, key id, key status, key
templates) for familiarity.

## Consequences

- Zero runtime dependencies in `crypto-core` — auditable, portable, fast.
- Demonstrates the primitives directly rather than wrapping a library.
- Must manually implement: key rotation logic, DEK wrapping, AAD binding, memory zeroing.
- Production deployments should integrate Cloud KMS for KEK unwrapping; the record as
  written in April said `keyset-loader` already had the prod code path.

**Note added 2026-09-15, at the move to `docs/adr/`:** the last consequence is not true of
the code. `packages/crypto-core/src/keyset-loader.ts` throws
`Production KMS integration not yet implemented` when `CRYPTO_CORE_MODE=prod`, and the MAC
loader throws likewise. `docs/STATUS.md` row 5 carries the evidence; P1-A owns the path.
The decision itself stands.
