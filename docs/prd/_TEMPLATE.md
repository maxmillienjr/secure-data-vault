---
id: PX-Y
title: short imperative title
tier: 0
status: draft # draft | accepted | in-progress | shipped | superseded
size: S # S (~1-2 days) | M (~3-5 days) | L (~1-2 weeks)
depends_on: []
blocks: []
issue: null
superseded_by: null
---

# PX-Y · Title

## Problem

What is broken or missing today. State it with file:line evidence where the claim is
about this repo. No adjectives — a reader with the tree open can check every sentence in
this section in under a minute.

## Why it matters

One paragraph tying this to an external standard or a named practice (NIST SP 800-57, the
HIPAA Security Rule, SOC 2, OWASP ASVS, SLSA). This is the section that answers "so what."

## Scope

What this PRD delivers.

- Bullet per deliverable.

### Non-goals

What this PRD deliberately does not do, and which PRD picks it up instead.

## Design

The approach. Include the interface sketch, the file layout, or the workflow shape.
Prefer a concrete signature over a description of a signature. Where the design has two
axes — a dev keyset and a KMS key, an in-memory store and Postgres — say which axis each
part is verified on.

## Acceptance criteria

Checkable assertions. Each one should be something CI or a reviewer can verify as true or
false. A criterion that needs a caveat to be true is two criteria.

- [ ] ...

## Risks and open questions

Things that could make this wrong, and what would resolve them.

## References

Links to specs, standards, or docs that the design leans on.
