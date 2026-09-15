# 0006 · Property-based testing for tamper detection

**Status:** accepted
**Date:** 2026-04-11

## Context

Unit tests for audit-chain verification can only cover the specific tamper scenarios the
author imagines. A determined attacker might find mutations that pass verification.

## Decision

Use `fast-check` for property-based testing: generate random audit chains (3–15 entries),
mutate a random field at a random position, and assert that verification always fails.

## Consequences

- 100 random scenarios per test run, covering mutations the author did not explicitly
  imagine.
- Tests are slower (about 2 seconds) but provide much stronger guarantees.
- Complements, rather than replaces, explicit unit tests for specific scenarios.
