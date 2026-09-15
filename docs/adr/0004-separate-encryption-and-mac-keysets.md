# 0004 · Separate encryption and MAC keysets

**Status:** accepted
**Date:** 2026-04-11

## Context

A single keyset could be used for both AES-256-GCM encryption and HMAC-SHA-256 audit
signing. This is a keyset-confusion risk — using the same key material for different
cryptographic purposes violates the key-separation principle in NIST SP 800-57.

## Decision

Maintain two separate keysets:

- `INSECURE-DEV-ONLY.keyset.json` — encryption keys (AES-256-GCM).
- `INSECURE-DEV-ONLY.mac.keyset.json` — MAC keys (HMAC-SHA-256).

## Consequences

- Each keyset can rotate independently.
- Cloud KMS maps to two separate crypto keys with different purposes: `ENCRYPT_DECRYPT`
  for `vault-dek-master` and `MAC` for `vault-audit-mac` (`infra/kms.tf`).
- Slightly more configuration, but eliminates a class of cryptographic misuse.
