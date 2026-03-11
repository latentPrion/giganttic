# Data Model

This document describes the active `db/v2` schema implemented in
[schema.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/v2/schema.ts).

## DB Structure

Current `db/` layout:

```text
db/
├── apply-sql-ddl.mjs
├── config.json
├── config.ts
├── create-from-schema.mjs
├── generate-ddl.mjs
├── index.ts
├── migrations/
│   ├── README.md
│   └── <from-version>--<to-version>/
│       └── .gitkeep
└── <version-subdir>/
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

- Each schema version lives under `db/<version-subdir>/`.
- The active version is selected through `db/config.json`.
- Drizzle schema, generated Zod output, and generated SQL DDL are all version-driven.
- The root DB facade in [db/index.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/index.ts) re-exports the active version.

## Naming Rules

- Primary table names use `UpperCamelCase`.
- Join tables use underscore-separated names such as `Users_Projects_ProjectRoles`.
- Columns use `lowerCamelCase`.

## Primary and Reference Tables

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

`Projects`
- `id`
- `name`
- `description`
- `createdAt`
- `updatedAt`

`Teams`
- `id`
- `name`
- `description`
- `createdAt`
- `updatedAt`

`Organizations`
- `id`
- `name`
- `description`
- `createdAt`
- `updatedAt`

`SystemRoles`
- `code`
- `displayName`
- `description`
- `createdAt`

`ProjectRoles`
- `code`
- `displayName`
- `description`
- `createdAt`

`TeamRoles`
- `code`
- `displayName`
- `description`
- `createdAt`

`OrganizationRoles`
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

## Join and Auth Tables

`Projects_Users`
- `id`
- `projectId`
- `userId`
- `createdAt`

Constraint:
- unique on `(projectId, userId)`

`Teams_Users`
- `id`
- `teamId`
- `userId`
- `createdAt`

Constraint:
- unique on `(teamId, userId)`

`Projects_Teams`
- `id`
- `projectId`
- `teamId`
- `createdAt`

Constraint:
- unique on `(projectId, teamId)`

`Users_Organizations`
- `id`
- `organizationId`
- `userId`
- `createdAt`

Constraint:
- unique on `(organizationId, userId)`

`Projects_Organizations`
- `id`
- `organizationId`
- `projectId`
- `createdAt`

Constraint:
- unique on `(organizationId, projectId)`

`Organizations_Teams`
- `id`
- `organizationId`
- `teamId`
- `createdAt`

Constraints:
- unique on `(organizationId, teamId)`
- unique on `teamId`

Meaning:
- a team may belong to at most one organization
- an organization may own many teams

`Users_SystemRoles`
- `id`
- `userId`
- `roleCode`
- `createdAt`

Constraint:
- unique on `(userId, roleCode)`

`Users_Projects_ProjectRoles`
- `id`
- `userId`
- `projectId`
- `roleCode`
- `createdAt`

Constraint:
- unique on `(userId, projectId, roleCode)`

`Users_Teams_TeamRoles`
- `id`
- `userId`
- `teamId`
- `roleCode`
- `createdAt`

Constraint:
- unique on `(userId, teamId, roleCode)`

`Users_Organizations_OrganizationRoles`
- `id`
- `userId`
- `organizationId`
- `roleCode`
- `createdAt`

Constraint:
- unique on `(userId, organizationId, roleCode)`

`Users_CredentialTypes`
- `id`
- `userId`
- `credentialTypeCode`
- `credentialLabel`
- `createdAt`
- `updatedAt`
- `revokedAt`

Behavior:
- represents concrete credential instances owned by a user
- multiple rows per `(userId, credentialTypeCode)` are allowed only for credential types that opt into it
- password credentials are currently single-instance per user

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
- 1:1 extension row for a password credential instance
- stores password hashes only
- current algorithm is `argon2id`

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
- `sessionTokenHash` is unique
- `expirationTimestamp` must be greater than `startTimestamp`
- only token hashes are stored, never raw bearer tokens
- IP text may be IPv4 or IPv6
- OAuth columns are reserved for later work

## Seeded Role and Credential Codes

Credential types:
- `GGTC_CREDTYPE_USERNAME_PASSWORD`

System roles:
- `GGTC_SYSTEMROLE_ADMIN`

Project roles:
- `GGTC_PROJECTROLE_PROJECT_MANAGER`

Team roles:
- `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_TEAMROLE_PROJECT_MANAGER`

Organization roles:
- `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER`
- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER`

## Access and Membership Semantics

- Users may belong directly to many projects through `Projects_Users`.
- Users may belong directly to many teams through `Teams_Users`.
- Users may belong directly to many organizations through `Users_Organizations`.
- Users may also count as organization members indirectly by belonging to a team owned by that organization.
- Projects may be associated directly to many organizations through `Projects_Organizations`.
- Projects may also be associated to organizations indirectly when an org-owned team is linked through `Projects_Teams`.
- Teams belong to at most one organization through `Organizations_Teams`.

## Effective Authority Model

The schema stores scoped role assignments, but some authorization and orphan-prevention rules use computed effective authority.

Effective project manager may come from:
- direct `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `GGTC_TEAMROLE_PROJECT_MANAGER` on a linked team
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER` on an organization directly associated to the project
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER` on an organization that owns a linked team

Effective project manager does not include:
- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` by itself

Effective team manager may come from:
- direct `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` on the team's owning organization

## Current Application-Level Invariants

These are enforced by backend services, not just by FK or uniqueness constraints:

- a team must retain at least one effective team manager unless the team itself is being deleted
- a project must retain at least one effective project manager after direct membership replacement or direct project-role revoke
- an organization must retain at least one `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- organization deletion is blocked while the organization still owns any team
- direct org-project associations block organization deletion only when removing that organization would strand a directly associated project without any remaining effective project manager
- user deletion is blocked if the user is the final effective team manager for any team or the final effective project manager for any project

## Source of Truth

- Drizzle schema: [schema.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/v2/schema.ts)
- Versioned DB facade: [index.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/v2/index.ts)
- Root DB facade: [index.ts](/media/latentprion/aafe96c9-7fcd-40ce-991d-ca2d23b5ba17/gits/gigantt-git/db/index.ts)
