# 0003 · Yarn 4 workspaces over a build orchestrator

**Status:** accepted
**Date:** 2026-04-11

## Context

Two framings of this decision are on record, and both are kept here because both were
made.

Against a build orchestrator (`.context/decisions.md`, ADR-003 as written in April):
monorepo tooling options were Nx, Turborepo, Lerna, or native package-manager workspaces.
This is a reference project, not a 50-package enterprise monorepo.

Against another package manager (`CLAUDE.md`, "Key Decisions", and the original build
specification): Yarn rather than npm or pnpm workspaces, because the `packages/` libraries
use the `workspace:*` protocol for cross-package references and Yarn's hoisting behaviour
is well understood for monorepo CI caching.

## Decision

Use Yarn 4 with native workspaces and `nodeLinker: node-modules`. No additional build
orchestration layer.

## Consequences

- Zero additional tooling to learn or configure.
- `workspace:*` protocol for internal dependencies.
- Topological build order via `yarn workspaces foreach -A --topological run build`.
- Root scripts fan out with `yarn workspaces foreach -A run <script>`; there is no task
  graph and no remote cache, so every gate runs every workspace every time.
- If the project grows significantly, Turborepo can be layered on top without
  restructuring.
