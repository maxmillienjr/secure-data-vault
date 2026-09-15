# Architecture Decision Records

The records live in [`docs/adr/`](../docs/adr/README.md), one file per decision in Nygard
format (context, decision, consequences), indexed by `docs/adr/README.md`.

ADR-001 through ADR-008 moved there on 2026-09-15 and kept their numbers as `0001`–`0008`.
This file stays so that older links resolve. Add new records in `docs/adr/`, not here; a
record is never edited after it reaches `accepted`, only superseded by a new one.

| Former id | Now                                                                              |
| --------- | -------------------------------------------------------------------------------- |
| ADR-001   | [0001](../docs/adr/0001-node-native-crypto-over-google-tink.md)                  |
| ADR-002   | [0002](../docs/adr/0002-drizzle-orm-over-prisma-and-typeorm.md)                  |
| ADR-003   | [0003](../docs/adr/0003-yarn-4-workspaces-over-a-build-orchestrator.md)          |
| ADR-004   | [0004](../docs/adr/0004-separate-encryption-and-mac-keysets.md)                  |
| ADR-005   | [0005](../docs/adr/0005-rfc-7807-problem-details-for-all-errors.md)              |
| ADR-006   | [0006](../docs/adr/0006-property-based-testing-for-tamper-detection.md)          |
| ADR-007   | [0007](../docs/adr/0007-single-root-terraform-until-repetition-earns-modules.md) |
| ADR-008   | [0008](../docs/adr/0008-generated-database-credential-in-secret-manager.md)      |
