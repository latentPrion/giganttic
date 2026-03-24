# Scoped Access Tokens

## Overview

Scoped Access Tokens are revocable credentials minted by a user and redeemable from a URL query string. Redeeming one creates a normal authenticated session, but that session is marked as `scopedAccessToken` authenticated and is deny-by-default at the route layer.

Only explicitly allowlisted REST routes are available to scoped sessions.

## Goals

- Keep primary auth model intact (sessions, credential types, user authority).
- Avoid broad "login-as-user" behavior for anonymous link visitors.
- Support object-scoped authorization with a polymorphic join model.
- Allow mutable scope without rotating the underlying token.
- Keep revocation simple and immediate.

## Core Model

### Credential Type

Add a new credential type code:

- `CREDTYPE_SCOPED_ACCESS_TOKEN`

This credential type behaves like a mintable bearer secret owned by a user.

### Token Authority Source

Each scoped token has an authority source user (`ownerUserId`), and access checks are evaluated as:

1. Owner user must currently have authority for the object.
2. Token must explicitly include the object in its scope join table.

Access is granted only when both are true.

## Schema Proposal

### `Users_ScopedAccessTokenCredentials`

One row per minted token credential.

- `id` (PK)
- `ownerUserId` (FK -> `Users.id`)
- `credentialTypeCode` (FK -> `CredentialTypes.code`, fixed to `CREDTYPE_SCOPED_ACCESS_TOKEN`)
- `tokenHash` (unique, secret hash only; never store raw token)
- `tokenLabel` (nullable user label)
- `expiresAt` (nullable)
- `revokedAt` (nullable)
- `lastUsedAt` (nullable)
- `createdAt`
- `updatedAt`

Recommended constraints:

- unique index on `tokenHash`
- index on `(ownerUserId, revokedAt)`
- check: `expiresAt IS NULL OR expiresAt > createdAt`

### `ScopedAccessObjectTypes` (enum reference table)

- `code` (PK)
- `displayName`
- `description`

Seed values:

- `SCOPED_ACCESS_OBJECT_TYPE_PROJECT`
- `SCOPED_ACCESS_OBJECT_TYPE_TEAM`
- `SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION`

### `ScopedAccessTokenCredentials_Objects`

Polymorphic scope assignments (1 token -> N scoped objects).

- `id` (PK)
- `scopedAccessTokenCredentialId` (FK -> `Users_ScopedAccessTokenCredentials.id`)
- `scopedAccessObjectTypeCode` (FK -> `ScopedAccessObjectTypes.code`)
- `scopedAccessObjectId` (integer object id, polymorphic target id)
- `createdAt`
- `updatedAt`

Required uniqueness:

- unique composite on `(scopedAccessTokenCredentialId, scopedAccessObjectTypeCode, scopedAccessObjectId)`

Recommended indexes:

- index on `(scopedAccessObjectTypeCode, scopedAccessObjectId)`
- index on `scopedAccessTokenCredentialId`

## Session Integration

When token redemption succeeds, create a normal session row with provenance markers:

- `authCredentialTypeCode = CREDTYPE_SCOPED_ACCESS_TOKEN`
- `authCredentialId = Users_ScopedAccessTokenCredentials.id`

If session table already has equivalent auth-source columns, use those.

The session should still use normal `sessionTokenHash`, expiry, and revoke mechanics.

## Authentication Flow

1. Visitor provides token once via URL query string.
2. Backend validates token hash, expiry, and revocation status.
3. Backend mints standard session cookie.
4. Backend removes token from URL (redirect without query token).
5. Session is treated as authenticated, but scoped restrictions apply.

## Authorization Flow (Deny-First)

For sessions authenticated via `CREDTYPE_SCOPED_ACCESS_TOKEN`:

1. Deny all routes by default.
2. Allow only explicit route allowlist required by Project SPA.
3. For allowlisted project-resource routes, enforce:
   - session token is not revoked/expired
   - scoped token row is not revoked/expired
   - owner still has project authority
   - token has object mapping:
     - `SCOPED_ACCESS_OBJECT_TYPE_PROJECT`
     - `scopedAccessObjectId = requested projectId`

Credential-management and other sensitive account routes remain denied.

## Scope Mutability

Token scope can be updated without rotating token secret:

- Add object: insert row in `ScopedAccessTokenCredentials_Objects`.
- Remove object: delete row from `ScopedAccessTokenCredentials_Objects`.
- Remove all objects: token remains minted but authorizes nothing.
- Revoke token: set `revokedAt`; all future authorizations fail.

This gives dynamic access management while preserving token continuity.

## Security Notes

- Store only token hashes (with app-level pepper if available).
- Use high-entropy opaque secrets (at least 128 bits).
- Prefer short default TTL; allow explicit longer durations if needed.
- Rate-limit token redemption endpoint.
- Audit redemption attempts and successful uses.
- Consider optional policy: revoking token revokes all linked active sessions.

## Validation Rules

- Object existence validation should run on scope write (insert/update), at least for currently supported object types (`PROJECT` first).
- Type-aware validators should reject mismatched type/id pairs.
- Route handlers must not trust `projectId` in request body alone; re-resolve from route params and enforce scope checks there.

## Rollout Plan (Incremental)

1. Add schema and migrations for token + object type + polymorphic join.
2. Seed `ScopedAccessObjectTypes`.
3. Add token mint/list/revoke endpoints.
4. Add scope add/remove endpoints (project-only first).
5. Add token redemption endpoint and session provenance wiring.
6. Add deny-all scoped-session middleware + explicit allowlist for Project SPA.
7. Add audit logging and tests.

## Test Cases

- Redeem succeeds for active token and valid hash.
- Redeem fails for revoked token.
- Redeem fails for expired token.
- Scoped session denied on non-allowlisted routes.
- Scoped session denied when token has no matching project object.
- Scoped session denied if owner no longer has project authority.
- Scoped session allowed on allowlisted project routes when both checks pass.
- Scope removal immediately blocks access without session rotation.
- Composite uniqueness prevents duplicate `(tokenId, objectType, objectId)` rows.

