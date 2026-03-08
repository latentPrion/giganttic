# Deletion Cascade

This document describes the current deletion and cascade behavior of the active
`db/v2` schema, plus the service-layer ordering constraints that matter for
teams and projects.

## Database Cascade Rules

The current schema uses foreign-key cascades for membership, assignment, and
credential/session child rows.

### Deleting a User cascades to

- `Projects_Users`
- `Teams_Users`
- `Users_SystemRoles`
- `Users_Projects_ProjectRoles`
- `Users_Teams_TeamRoles`
- `Users_CredentialTypes`
- `Users_Sessions`

Additional chained cascade:

- deleting `Users_CredentialTypes` cascades to `Users_PasswordCredentials`

### Deleting a Team cascades to

- `Teams_Users`
- `Projects_Teams`
- `Users_Teams_TeamRoles`

### Deleting a Project cascades to

- `Projects_Users`
- `Projects_Teams`
- `Users_Projects_ProjectRoles`

## Restrict Rules

Role/code reference rows are protected with `ON DELETE RESTRICT`.

That means these rows cannot be deleted while assignments still reference them:

- `SystemRoles`
- `ProjectRoles`
- `TeamRoles`
- `CredentialTypes`

Practical effect:

- do not try to delete a role code before deleting all assignment rows that
  reference it
- do not try to delete the username/password credential type while user
  credential rows still exist

## Service-Layer Ordering Constraints

The team/project services enforce invariants partly in application logic, not
only in foreign keys.

### Team membership replacement

Current order in `TeamsService.replaceTeamMembers`:

1. authorize caller
2. verify team exists
3. verify all referenced users exist
4. verify the submitted replacement set still contains at least one
   `GGTC_TEAMROLE_TEAM_MANAGER`
5. delete existing `Users_Teams_TeamRoles` rows for the team
6. delete existing `Teams_Users` rows for the team
7. insert replacement `Teams_Users` rows
8. insert replacement `Users_Teams_TeamRoles` rows

Why this matters:

- role rows must be deleted before membership rows are rebuilt, otherwise the
  replacement operation can leave stale role assignments
- the last-manager check must happen before destructive replacement begins

### Project membership replacement

Current order in `ProjectsService.replaceProjectMembers`:

1. authorize caller
2. verify project exists
3. verify all referenced users exist
4. verify the submitted replacement set still contains at least one
   `GGTC_PROJECTROLE_PROJECT_MANAGER`
5. delete existing `Users_Projects_ProjectRoles` rows for the project
6. delete existing `Projects_Users` rows for the project
7. insert replacement `Projects_Users` rows
8. insert replacement `Users_Projects_ProjectRoles` rows

Why this matters:

- role rows must be cleared before rebuilding the membership snapshot
- the last-project-manager check must happen before destructive replacement
  begins

## Parent Delete Semantics

Team and project deletion now uses explicit child-row cleanup before deleting the
parent row.

Current team delete order:

1. delete `Users_Teams_TeamRoles` rows for the team
2. delete `Teams_Users` rows for the team
3. delete `Projects_Teams` rows for the team
4. delete the `Teams` parent row

Current project delete order:

1. delete `Users_Projects_ProjectRoles` rows for the project
2. delete `Projects_Users` rows for the project
3. delete `Projects_Teams` rows for the project
4. delete the `Projects` parent row

Why this is important:

- deleting the parent should not be blocked by the "must retain one manager"
  invariant
- the last-manager rule applies to membership replacement, not to deleting the
  team/project altogether
- explicit delete ordering is currently more reliable in this runtime than
  assuming FK cascades will fully clean up child rows for these aggregates

## Current Safe Mental Model

When removing an entire aggregate:

- delete the parent row and let FK cascades clean up children

When replacing membership:

- validate invariants first
- clear scoped child assignment rows first
- rebuild membership and role rows in the same transaction

## Useful Future Tests

Useful cascade-focused tests that do not currently exist:

- deleting a team removes all rows from `Teams_Users`, `Projects_Teams`, and
  `Users_Teams_TeamRoles` for that team
- deleting a project removes all rows from `Projects_Users`, `Projects_Teams`,
  and `Users_Projects_ProjectRoles` for that project
- deleting a user cascades through direct project access, team membership,
  scoped role assignments, sessions, credential instances, and password rows
- deleting a role-code reference row fails while assignments still reference it
