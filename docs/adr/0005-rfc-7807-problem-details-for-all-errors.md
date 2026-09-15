# 0005 · RFC 7807 Problem Details for all errors

**Status:** accepted
**Date:** 2026-04-11

## Context

REST APIs commonly return ad-hoc error formats (`{ error: "...", message: "..." }`), making
client-side error handling inconsistent.

## Decision

All error responses use [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807)
`application/problem+json` with `type`, `title`, `status`, `detail`, and optional
`instance` (correlation id) and `errors` (validation details).

## Consequences

- A single `HttpExceptionFilter` handles all error formatting.
- Clients can rely on a consistent error contract.
- Zod validation errors include per-field details in the `errors` array.
- The `instance` field carries the `X-Request-ID` for support correlation.
