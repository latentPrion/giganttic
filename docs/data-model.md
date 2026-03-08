# Data Model

This document describes the current database layout and the active auth-oriented
data model implemented in [db/v1/schema.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/v1/schema.ts).

## DB Structure

Current `db/` layout:

```text
db/
├── apply-sql-ddl.mjs
├── config.json
├── config.ts
├── create-db.mjs
├── generate-ddl.mjs
├── index.ts
├── migrations/
│   ├── README.md
│   └── v1--v2/
│       └── .gitkeep
└── v1/
    ├── generated-sql-ddl/
    │   └── schema.sql
    ├── generated-zod/
    │   └── index.ts
    ├── index.ts
    ├── schema.ts
    └── tests/
        ├── schema.test.ts
        └── sqlite-ddl.test.ts
```

Notes:

- Each schema version lives in `db/<version>/`.
- The canonical schema is written in TypeScript with Drizzle.
- Zod artifacts for that schema version live in `generated-zod/`.
- SQL DDL for that schema version is generated into `generated-sql-ddl/schema.sql`.
- The repo currently keeps one full-schema DDL file per version, not a chain of
  checked-in migration SQL files.
- Version-agnostic helpers live directly under `db/`.
- The active schema version is selected via `db/config.json` and surfaced through
  the root `db` module.

## Naming Rules

- Primary table names use `UpperCamelCase`.
- Relationship tables join primary table names with underscores, for example
  `Users_Roles`.
- Column names use `lowerCamelCase`.

## Current Schema

### Primary and Reference Tables

`Users`
- `id`
- `username`
- `email`
- `isActive`
- `createdAt`
- `updatedAt`
- `deactivatedAt`
- `deletedAt`

Constraints:
- `username` is globally unique.
- `email` is globally unique.

`Roles`
- `code`
- `displayName`
- `description`
- `createdAt`

`CredentialTypes`
- `code`
- `displayName`
- `description`
- `allowsMultiplePerUser`
- `createdAt`

### Relationship and Auth Tables

`Users_Roles`
- `id`
- `userId`
- `roleCode`
- `createdAt`

Constraints:
- unique on `(userId, roleCode)`

`Users_CredentialTypes`
- `id`
- `userId`
- `credentialTypeCode`
- `credentialLabel`
- `createdAt`
- `updatedAt`
- `revokedAt`

Behavior:
- This table represents concrete credential instances owned by a user.
- Multiple rows for the same `(userId, credentialTypeCode)` are allowed for
  credential types that support multiple credentials per user.
- Password credentials are a special case: each user may have at most one
  `GGTC_CREDTYPE_USERNAME_PASSWORD` credential instance.

`Users_PasswordCredentials`
- `id`
- `userCredentialTypeId`
- `passwordHash`
- `passwordAlgorithm`
- `passwordVersion`
- `passwordUpdatedAt`
- `createdAt`
- `updatedAt`

Behavior:
- This is a 1:1 extension of a password-type row in `Users_CredentialTypes`.
- Passwords are stored as hashes only.
- The current implementation uses `argon2id`.

`Users_Sessions`
- `id`
- `userId`
- `sessionTokenHash`
- `startTimestamp`
- `expirationTimestamp`
- `ipAddress`
- `location`
- `oauthAuthorizationCode`
- `oauthAccessToken`
- `oauthRefreshToken`
- `revokedAt`
- `createdAt`
- `updatedAt`

Constraints and behavior:
- `sessionTokenHash` is unique.
- `expirationTimestamp` must be greater than `startTimestamp`.
- The backend stores only the token hash, not the raw bearer token.
- `ipAddress` stores either IPv4 or IPv6 text.
- OAuth-related columns are reserved for later work.

## Seed Data

Current auth seed data includes:

Credential types:
- `GGTC_CREDTYPE_USERNAME_PASSWORD`

Roles:
- `GGTC_ROLE_PROJECT_MANAGER`
- `GGTC_ROLE_ADMIN`

## Auth Model Notes

- A user may have zero or more roles.
- A user must have at least one credential instance at registration time; that
  rule is enforced by application logic rather than a standalone SQLite schema
  constraint.
- A user may have multiple credential instances over time.
- Only the username/password credential type is implemented today.
- Sessions are revocable and expire independently.

## Source of Truth

The current source of truth is:

- Drizzle schema: [db/v1/schema.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/v1/schema.ts)
- Versioned DB facade: [db/v1/index.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/v1/index.ts)
- Root schema-agnostic facade: [db/index.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/index.ts)
