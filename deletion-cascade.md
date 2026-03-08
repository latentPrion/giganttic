# Deletion Cascade

This document describes the current deletion ordering and integrity rules for
the active `db/v2` schema.

## Database Cascade Rules

The schema uses FK cascades for most child rows.

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

## Integrity Before Physical Delete

FK cascades are not enough on their own. The services now validate semantic
coverage before allowing a destructive operation to continue.

### Team integrity

- a team must retain at least one `GGTC_TEAMROLE_TEAM_MANAGER` unless the team
  itself is being deleted
- deleting a team is blocked if that team's removal would strand any linked
  project without an effective project manager

### Project integrity

- a project must retain at least one effective project manager after:
  - direct membership replacement
  - direct project-role revocation
- effective project manager means:
  - direct `GGTC_PROJECTROLE_PROJECT_MANAGER`, or
  - linked-team `GGTC_TEAMROLE_PROJECT_MANAGER`
- deleting the project itself is allowed once the caller is authorized, because
  the aggregate is disappearing

### User integrity

- a user cannot be deleted if xe is the final effective project manager for any
  project
- a user cannot be deleted if xe is the final `GGTC_TEAMROLE_TEAM_MANAGER` for
  any team
- these checks apply to self-delete and admin-delete

## Current Service Ordering

### Team membership replacement

1. authorize caller
2. verify team exists
3. verify referenced users exist
4. verify replacement keeps at least one `TEAM_MANAGER`
5. verify linked projects still retain an effective project manager after the
   replacement team's `TEAMROLE_PROJECT_MANAGER` set changes
6. delete existing `Users_Teams_TeamRoles` rows for the team
7. delete existing `Teams_Users` rows for the team
8. insert replacement `Teams_Users`
9. insert replacement `Users_Teams_TeamRoles`

### Team deletion

1. verify team exists
2. verify caller has direct `TEAM_MANAGER` ownership
3. verify deleting the team would not strand any linked project
4. delete `Users_Teams_TeamRoles`
5. delete `Teams_Users`
6. delete `Projects_Teams`
7. delete the `Teams` row

### Project membership replacement

1. authorize caller
2. verify project exists
3. verify referenced users exist
4. verify the replacement direct-membership set plus existing linked-team PMs
   still leaves at least one effective project manager
5. delete existing `Users_Projects_ProjectRoles`
6. delete existing `Projects_Users`
7. insert replacement `Projects_Users`
8. insert replacement `Users_Projects_ProjectRoles`

### Project deletion

1. verify project exists
2. verify caller is an effective project manager
3. delete `Users_Projects_ProjectRoles`
4. delete `Projects_Users`
5. delete `Projects_Teams`
6. delete the `Projects` row

### User deletion

1. verify target user exists
2. verify caller is self or system admin
3. verify deleting the user would not leave any project without an effective
   project manager
4. verify deleting the user would not leave any team without a team manager
5. delete child rows in explicit order:
   - `Users_Sessions`
   - `Users_Projects_ProjectRoles`
   - `Users_Teams_TeamRoles`
   - `Projects_Users`
   - `Teams_Users`
   - `Users_CredentialTypes`
6. delete the `Users` row

## Admin Self-Grant Constraint

System admin does not bypass the manager-integrity rules for aggregate deletion.

Current implemented path:

- admin may self-grant direct `GGTC_TEAMROLE_TEAM_MANAGER` on any team
- admin may self-grant direct `GGTC_PROJECTROLE_PROJECT_MANAGER` on any project
- after taking explicit ownership, admin may proceed with delete if the
  remaining integrity checks still pass

## Non-Mutable Project-Team Links

`Projects_Teams` links are respected when computing effective project-manager
coverage, but there is currently no public API that adds or removes those links.
