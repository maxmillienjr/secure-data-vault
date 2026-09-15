---
id: P1-A
title: KMS-backed key encryption behind a KeyProvider seam
tier: 1
status: draft
size: L
depends_on: []
blocks: []
issue: null
superseded_by: null
---

# P1-A · KMS-backed key encryption behind a `KeyProvider` seam

## Problem

The key-encryption key is a file. `encrypt.ts:43-49` wraps each record's DEK with the
primary key of a `KeysetHandle`, and the only `KeysetHandle` the service can obtain comes
from `loadEncryptionKeyset` reading `INSECURE-DEV-ONLY.keyset.json` off disk
(`keyset-loader.ts:38-40`). `CryptoService.onModuleInit` loads it once (`crypto.service.ts:21-24`).
With `CRYPTO_CORE_MODE=prod`, `keyset-loader.ts:27-30` throws
`Production KMS integration not yet implemented`, so a production configuration cannot
start, and every deployment that runs is a `dev` deployment.

The infrastructure for the other half exists and is unused. `infra/kms.tf:10-25` provisions
`vault-dek-master`, an HSM-backed `ENCRYPT_DECRYPT` key with 90-day rotation;
`infra/iam.tf:10-14` grants the service account `roles/cloudkms.cryptoKeyEncrypterDecrypter`
on it. `git grep -n kms -- apps packages` finds only the two throwing branches and the
`KMS_KEY_URI` check that precedes one of them.

The published artifact carries the file. `apps/vault-api/Dockerfile:63` copies
`packages/crypto-core/keysets` into the runtime stage; `release.yml:47-55` pushes that image
to GHCR as `latest`. The threat model's T-01 mitigation — a database breach yields
ciphertext only — holds against an attacker with the database and not the image.

Three documents describe the KMS path as present: `.context/architecture.md:34-35` draws
`KEK Unwrap` and `HMAC Key` edges to Cloud KMS, `packages/crypto-core/README.md:40` says
the HSM unwraps the keyset in hardware, and ADR 0001's last consequence says
`keyset-loader` has the prod code path. `docs/STATUS.md` rows 5 and 6 record this;
`README.md:222-226` is the one place the tree already says it plainly.

Two smaller facts the design has to carry. The DEK wrap has no AAD (`encrypt.ts:45-49`
calls `createCipheriv` and never `setAAD`), so a wrapped DEK is not bound to its record,
although the ciphertext it unlocks is. And the envelope's `keyId` is an integer keyset
index (`packages/crypto-core/src/types.ts:23`) mirrored by a `key_id integer` column
(`schema.ts:38`) and a `keyVersion varchar(50)` column (`schema.ts:37`); a Cloud KMS
`CryptoKeyVersion` resource name is a string of well over 50 characters.

## Why it matters

Envelope encryption is a key hierarchy, and NIST SP 800-57 Part 1 puts the weight of a
hierarchy on its wrapping keys: a key-wrapping key is protected at least as strongly as
what it wraps, and custody of it is separated from custody of the data. A KEK read from a
file on the host that holds the ciphertext gives the hierarchy one level and the attacker
one target. The HIPAA Security Rule's encryption specification (§164.312(a)(2)(iv)) and SOC
2 CC6.1's requirements on the management of encryption keys are both satisfied or not by
where the KEK lives and who can call it, not by the cipher. Cloud KMS with an HSM
protection level is the mechanism this repository's own Terraform chose; the code has to
call it before any of the three documents above is true.

## Scope

- A `KeyProvider` interface in `packages/crypto-core`, and `encrypt`/`decrypt` refactored
  to take one instead of a `KeysetHandle`. The package stays dependency-free: the interface
  and the local implementation live here, the KMS client does not.
- `LocalKeysetProvider`: today's behaviour behind the interface, plus AAD on the DEK wrap.
- `GcpKmsKeyProvider` in `apps/vault-api/src/crypto/`, using `@google-cloud/kms`
  `encrypt`/`decrypt` with `additionalAuthenticatedData` against `KMS_KEY_URI`.
- `FakeKmsKeyProvider`, in-process and deterministic, selected by a `fake://` URI, refused
  when `NODE_ENV=production`. It is what CI runs; the real client is what a deployment runs.
- Provider selection in `CryptoService` on `CRYPTO_CORE_MODE` and `KMS_KEY_URI`, failing
  closed at startup with one wrap/unwrap self-test.
- Envelope and schema changes to carry a KMS key version; a compatibility path for
  envelopes written before this change.
- The e2e suite run on both axes in `e2e.yml`.
- A manual smoke runbook against a real key ring, documented as manual.
- The prose in the three documents above, and `docs/STATUS.md` rows 5 and 6, moved to what
  is true.

### Non-goals

- **The MAC key's production path.** `loadMacKeyset` still throws under `prod`
  (`keyset-loader.ts:51`). It is P1-C's: a signature has to carry a key id before a second
  MAC key can exist, and whether the HMAC runs in KMS (one `macSign` per append, one
  `macVerify` per verified row) or over a KMS-wrapped local key is a cost decision P1-C
  makes with P4-B's traces in hand.
- **Rotation and re-wrap.** A KMS key with `rotation_period` produces new versions on its
  own; what happens to DEKs wrapped under old versions, and the drill that proves old
  records still decrypt after a rotation, is P1-B.
- **Removing the dev keysets from the image and refusing to start without a provider in
  every non-dev mode.** P1-D, once there is a production provider to start with.
- **A deploy target.** `docs/STATUS.md` row 38: nothing provisions the Cloud Run service the
  IAM presumes. This PRD needs Application Default Credentials wherever it runs; it does not
  create the place.

## Design

**The seam.**

```ts
// packages/crypto-core/src/key-provider.ts
export interface WrappedDek {
  /** Opaque bytes; the provider decides the layout. */
  wrapped: Buffer;
  /** Provider-specific key version that produced `wrapped`. */
  keyVersion: string;
}

export interface KeyProvider {
  /** Stable identifier for the KEK: a KMS CryptoKey resource name, or `local:<primaryKeyId>`. */
  readonly keyId: string;
  wrapDek(dek: Buffer, aad: Buffer): Promise<WrappedDek>;
  unwrapDek(wrapped: WrappedDek, aad: Buffer): Promise<Buffer>;
}

export function encrypt(
  plaintext: string,
  context: CryptoContext,
  provider: KeyProvider,
): Promise<EncryptedEnvelope>;
export function decrypt(
  envelope: EncryptedEnvelope,
  context: CryptoContext,
  provider: KeyProvider,
): Promise<string>;
```

`encrypt` keeps its data path (`encrypt.ts:31-41`) and replaces `encrypt.ts:43-52` with
`provider.wrapDek(dek, aad)`. `decrypt` replaces `decrypt.ts:26-46` with
`provider.unwrapDek(...)`. The AAD passed to the wrap is the same `recordId:tenantId` buffer
the data path uses, which closes the unbound-wrap fact above on both providers.

**Local provider.** `LocalKeysetProvider(keyset: KeysetHandle)` reproduces today's layout
(`IV || wrapped || tag`), adds `setAAD`, reports `keyId = local:<primaryKeyId>` and
`keyVersion = <KeyEntry.version>`. `loadEncryptionKeyset` returns a provider rather than a
handle. The four extra exports at `packages/crypto-core/src/index.ts:3-4` become internal
to the local provider, which closes STATUS row 7 as a side effect and is noted there.

**KMS provider.** `apps/vault-api/src/crypto/gcp-kms-key.provider.ts` wraps
`KeyManagementServiceClient`:

```ts
wrapDek(dek, aad) {
  const [res] = await client.encrypt({ name: keyUri, plaintext: dek, additionalAuthenticatedData: aad });
  return { wrapped: Buffer.from(res.ciphertext), keyVersion: res.name };   // CryptoKeyVersion
}
unwrapDek({ wrapped }, aad) {
  const [res] = await client.decrypt({ name: keyUri, ciphertext: wrapped, additionalAuthenticatedData: aad });
  return Buffer.from(res.plaintext);
}
```

`decrypt` is called on the CryptoKey, not the version; KMS selects the version from the
ciphertext, so a rotated key decrypts old DEKs while the old version is enabled. That is
what makes P1-B a drill rather than a migration. `@google-cloud/kms` is a dependency of
`apps/vault-api` only; `packages/crypto-core/package.json` keeps no `dependencies` block.

**Fake provider.** `FakeKmsKeyProvider` holds one random 32-byte key for the process, wraps
with AES-256-GCM and the AAD, reports `keyVersion` as `fake://<uri>/cryptoKeyVersions/1`,
and counts calls so a test can assert one wrap per encrypt. `KMS_KEY_URI=fake://...`
selects it; the constructor throws when `NODE_ENV=production`.

**Selection and startup.** `CryptoService.onModuleInit`:

| `CRYPTO_CORE_MODE` | `KMS_KEY_URI`  | Provider              | On failure          |
| ------------------ | -------------- | --------------------- | ------------------- |
| `dev` (default)    | ignored        | `LocalKeysetProvider` | throw (as today)    |
| `prod`             | `projects/...` | `GcpKmsKeyProvider`   | throw before listen |
| `prod`             | `fake://...`   | `FakeKmsKeyProvider`  | throw if production |
| `prod`             | unset          | —                     | throw before listen |

After construction the service wraps and unwraps one random DEK and logs
`key provider ready: <keyId>`. `keyId` is a resource name, not a secret. Nothing on either
path logs the DEK, the wrapped DEK or the AAD.

**Envelope and schema.** `EncryptedEnvelope` gains `provider: 'local' | 'gcp-kms'`, keeps
`keyVersion` (now the CryptoKeyVersion resource name under KMS) and keeps `keyId` for wire
compatibility with envelopes already written. `records.key_version` widens from
`varchar(50)` to `text`. An envelope with no `provider` field is read as `local`; a
committed fixture written at `65c144b` proves the path. `EncryptedEnvelopeSchema` in
`packages/shared-types/src/record.schema.ts` changes in the same commit, and a type-level
test asserts the two shapes agree.

**Two axes in CI.** `e2e.yml` runs the suite twice: `CRYPTO_CORE_MODE=dev`, and
`CRYPTO_CORE_MODE=prod KMS_KEY_URI=fake://ci`. The real KMS axis is a runbook
(`docs/runbooks/kms-smoke.md`): `terraform apply`, ADC, `KMS_KEY_URI` from the
`dek_master_key_id` output, one create and one read, and the two KMS audit-log entries that
prove the calls happened.

## Acceptance criteria

- [ ] `KeyProvider`, `WrappedDek` and `LocalKeysetProvider` are exported from
      `@secure-data-vault/crypto-core`; `packages/crypto-core/package.json` has no
      `dependencies` block; `@google-cloud/kms` appears in `apps/vault-api/package.json`
      only.
- [ ] `encrypt` and `decrypt` take a `KeyProvider`; the 14 existing crypto-core tests pass
      against `LocalKeysetProvider`.
- [ ] A wrapped DEK moved to another record's envelope fails to unwrap on both the local
      and the fake provider (new test; this is the AAD-on-wrap fact).
- [ ] `CRYPTO_CORE_MODE=prod` with `KMS_KEY_URI` unset exits non-zero before the port is
      bound; the e2e harness asserts the process never answers `/api/v1/health`.
- [ ] `CRYPTO_CORE_MODE=prod KMS_KEY_URI=fake://test` boots, and the e2e suite passes on
      that axis with the same count it passes on `dev`.
- [ ] `FakeKmsKeyProvider` throws when constructed with `NODE_ENV=production` (unit test).
- [ ] An envelope committed as a fixture from `65c144b` — no `provider`, integer `keyId` —
      decrypts through `LocalKeysetProvider`.
- [ ] `records.key_version` is `text`, and a KMS-wrapped envelope's full
      `CryptoKeyVersion` name round-trips through the column on the fake axis.
- [ ] `EncryptedEnvelopeSchema` parses every envelope `encrypt` produces on both providers
      (test), and the crypto-core type is assignable to the schema's inferred type
      (type-level test).
- [ ] With a logger spy on both providers, neither the DEK's base64 nor its hex appears in
      any log line during a wrap/unwrap (test).
- [ ] Startup logs exactly one `key provider ready: <keyId>` line, where `keyId` is the
      configured resource name or `local:<n>`.
- [ ] `e2e.yml` runs both axes and both are green.
- [ ] `docs/runbooks/kms-smoke.md` exists and has been executed once against a real key
      ring by someone with ADC; the runbook records the date and the two KMS audit-log
      entries. This criterion is met on the real axis only and stays unchecked until then.
- [ ] `docs/STATUS.md` rows 5, 6 and 7 are updated; `.context/architecture.md:34-35`,
      `packages/crypto-core/README.md:40` and `README.md:222-226` say what the code does.
- [ ] `yarn typecheck`, `yarn lint`, `yarn test`, `yarn lint:docs` and `yarn format:check`
      pass.

## Risks and open questions

- **Per-record KMS calls are the design, and they are the cost.** One `encrypt` call per
  write and one `decrypt` call per read, each a network round trip to KMS. The alternative
  is a KMS-wrapped local KEK unwrapped once at boot — one call per process, the KEK in
  process memory for its lifetime, and rotation that requires a restart. This PRD chooses
  the per-DEK call because it is what keeps the KEK out of the process entirely, which is
  the property the threat model claims. What would flip it: a p99 read latency measured
  under P4-B's traces that the service cannot carry. The design leaves the seam able to
  hold either.
- **The fake axis cannot prove IAM.** Every CI run passes on `fake://`; the
  `cryptoKeyEncrypterDecrypter` binding at `infra/iam.tf:10-14` is exercised only by the
  runbook. A wrong role, a wrong project or a disabled key version is invisible until
  someone runs it. The runbook criterion is separate for that reason.
- **The path has never executed, so the defect count is unknown.** `L` is a floor, not an
  estimate. ADC on the machine that runs the runbook, the `google` provider's `~> 5.0` pin
  against the current KMS API surface, and the CryptoKeyVersion name length in
  `varchar(50)` are three things already known to need attention; the fourth is the one
  nobody has found yet.
- **Widening `key_version` is a schema change on a repository whose migration story is
  `drizzle-kit push`.** On dev data that is fine. If P2-D lands first, this PRD writes a
  generated migration instead; if not, the `push` diff is the migration and the PRD says so.
- **The envelope compatibility path is speculative.** No production data exists to be
  compatible with. It is kept because it is ten lines and because deleting it would make
  the `keyId` column a lie; if the owner would rather drop `keyId` and `key_id` outright,
  that is a smaller design and a valid one.

## References

- NIST SP 800-57 Part 1 Rev. 5, _Recommendation for Key Management_, §5 (key types and
  the protection of key-wrapping keys).
- Google Cloud KMS, _Envelope encryption_ and the `encrypt`/`decrypt` methods with
  `additionalAuthenticatedData`.
- HIPAA Security Rule, 45 CFR §164.312(a)(2)(iv) and §164.312(e)(2)(ii).
- AICPA Trust Services Criteria, CC6.1.
- ADR 0001 (native crypto), ADR 0004 (separate keysets), `docs/STATUS.md` rows 5, 6, 7, 38.
