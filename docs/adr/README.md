# Architecture Decision Records

One file per decision, numbered sequentially, in the format popularized by Michael Nygard:
context, decision, consequences. A record is never edited after it reaches `accepted` —
if the decision changes, write a new record and mark the old one `superseded by NNNN`.

The bar for writing one: a reviewer would reasonably ask "why did you do it that way," and
the answer is not obvious from the code.

Records 0001–0008 were moved here from `.context/decisions.md` on 2026-09-15 with their
numbers and dates intact. Where a recorded consequence has since stopped being true of the
code, the record carries a dated note pointing at the `docs/STATUS.md` row rather than a
silent edit.

| ID                                                                   | Title                                                | Status   |
| -------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| [0001](0001-node-native-crypto-over-google-tink.md)                  | Node.js native crypto over Google Tink               | accepted |
| [0002](0002-drizzle-orm-over-prisma-and-typeorm.md)                  | Drizzle ORM over Prisma and TypeORM                  | accepted |
| [0003](0003-yarn-4-workspaces-over-a-build-orchestrator.md)          | Yarn 4 workspaces over a build orchestrator          | accepted |
| [0004](0004-separate-encryption-and-mac-keysets.md)                  | Separate encryption and MAC keysets                  | accepted |
| [0005](0005-rfc-7807-problem-details-for-all-errors.md)              | RFC 7807 Problem Details for all errors              | accepted |
| [0006](0006-property-based-testing-for-tamper-detection.md)          | Property-based testing for tamper detection          | accepted |
| [0007](0007-single-root-terraform-until-repetition-earns-modules.md) | Single-root Terraform until repetition earns modules | accepted |
| [0008](0008-generated-database-credential-in-secret-manager.md)      | Generated database credential in Secret Manager      | accepted |
