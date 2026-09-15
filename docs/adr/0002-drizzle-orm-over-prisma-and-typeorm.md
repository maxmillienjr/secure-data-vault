# 0002 · Drizzle ORM over Prisma and TypeORM

**Status:** accepted
**Date:** 2026-04-11

## Context

NestJS traditionally pairs with TypeORM or Prisma. Both have trade-offs:

- TypeORM: decorator-heavy, runtime schema, poor TypeScript inference.
- Prisma: code generation step, binary engine dependency, limited raw SQL escape hatches.

## Decision

Use Drizzle ORM for type-safe, SQL-like query building with zero code generation.

## Consequences

- Schema defined in TypeScript (`apps/vault-api/src/db/schema.ts`) — single source of
  truth.
- `drizzle-kit` handles migrations via `push` (dev) or `generate` + `migrate` (prod).
- SQL-like API is transparent — what you write is what executes.
- Smaller community than Prisma, but growing.

**Note added 2026-09-15, at the move to `docs/adr/`:** the `generate` + `migrate` half of
the second consequence has no implementation. `drizzle.config.ts` names an `out` directory
that is not tracked, and the production image's `entrypoint.sh` runs `drizzle-kit push` at
startup. `docs/STATUS.md` row 29 carries the evidence; P2-D owns the migration path. The
choice of Drizzle stands.
