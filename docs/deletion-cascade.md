# Deletion Cascade

This document describes the current delete ordering and orphan-prevention rules for the active `db/v2` backend.

## FK Cascade Behavior

### Deleting a User cascades to

- `Projects_Users`
- `Teams_Users`
- `Users_Organizations`
- `Users_SystemRoles`
- `Users_Projects_ProjectRoles`
- `Users_Teams_TeamRoles`
- `Users_Organizations_OrganizationRoles`
- `Users_CredentialTypes`
- `Users_Sessions`

Chained cascade:

- deleting `Users_CredentialTypes` cascades to `Users_PasswordCredentials`

### Deleting a Team cascades to

- `Teams_Users`
- `Projects_Teams`
- `Users_Teams_TeamRoles`
- `Organizations_Teams`

### Deleting a Project cascades to

- `Projects_Users`
- `Projects_Teams`
- `Users_Projects_ProjectRoles`
- `Projects_Organizations`

### Deleting an Organization cascades to

- `Users_Organizations`
- `Projects_Organizations`
- `Organizations_Teams`
- `Users_Organizations_OrganizationRoles`

## Integrity Rules Checked Before Delete

The services do not rely on FK cascades alone. They validate higher-level coverage rules first.

### Team delete

Team delete is blocked when removing that team would leave any linked project with zero effective project managers.

For team-delete calculations:

- direct project PMs still count
- linked-team PMs on other linked teams still count
- organization PMs still count only if their project authority survives independently of the team being deleted
- org-derived project-manager coverage that exists only through the team being deleted does not count

### Project delete

Project delete does not require a surviving project manager, because the project itself is disappearing.

Delete authorization still requires:

- effective project-manager authority, or
- admin first taking explicit ownership by self-granting direct project PM

### Organization delete

Organization delete currently works as follows:

- if the organization still owns any team through `Organizations_Teams`, delete is blocked
- direct project associations through `Projects_Organizations` do not block deletion by themselves
- instead, each directly associated project is checked to ensure that removing this organization's org-project-manager coverage would still leave at least one effective project manager

So current organization deletion requires all owned teams to be gone first, but direct org-project associations may be removed by the delete itself when project-manager coverage remains safe.

### User delete

User delete is blocked if removing that user would leave:

- any project with zero effective project managers
- any team with zero effective team managers

These checks apply to:

- self-delete
- admin delete

## Effective Coverage Used By Delete Checks

Effective project manager includes:

- direct `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `GGTC_TEAMROLE_PROJECT_MANAGER` on a linked team
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER` on a directly associated organization
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER` on an organization that owns a linked team

It does not include:

- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` by itself

Effective team manager includes:

- direct `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` on the owning organization

## Current Service Ordering

### Team membership replacement

1. verify team exists
2. authorize caller
3. verify referenced users exist
4. verify the replacement still leaves at least one effective team manager
5. verify linked projects still retain effective project-manager coverage after the replacement team-PM set
6. delete current `Users_Teams_TeamRoles`
7. delete current `Teams_Users`
8. insert replacement `Teams_Users`
9. insert replacement `Users_Teams_TeamRoles`

### Team role revoke

1. verify team exists
2. authorize caller for that specific team role
3. verify assignment exists
4. verify revocation would not remove the final effective team manager
5. verify revocation would not strand any linked project
6. delete the specific `Users_Teams_TeamRoles` row

### Team delete

1. verify team exists
2. verify caller has effective team-manager authority
3. verify deleting the team would not strand any linked project
4. delete `Users_Teams_TeamRoles`
5. delete `Teams_Users`
6. delete `Projects_Teams`
7. delete `Teams`

### Project membership replacement

1. verify project exists
2. authorize caller
3. verify referenced users exist
4. verify the replacement direct-membership set still leaves at least one effective project manager
5. delete current `Users_Projects_ProjectRoles`
6. delete current `Projects_Users`
7. insert replacement `Projects_Users`
8. insert replacement `Users_Projects_ProjectRoles`

### Project role revoke

1. verify project exists
2. authorize caller
3. verify assignment exists
4. verify revocation would not remove the final effective project manager
5. delete the specific `Users_Projects_ProjectRoles` row

### Project delete

1. verify project exists
2. verify caller has effective project-manager authority
3. delete `Users_Projects_ProjectRoles`
4. delete `Projects_Users`
5. delete `Projects_Teams`
6. delete `Projects`

### Organization delete

1. verify organization exists
2. verify caller has direct organization-manager authority
3. verify the organization has no remaining owned teams
4. verify each directly associated project would still retain effective project-manager coverage after the org is removed
5. delete `Users_Organizations_OrganizationRoles`
6. delete `Users_Organizations`
7. delete `Projects_Organizations`
8. delete `Organizations_Teams`
9. delete `Organizations`

### User delete

1. verify target user exists
2. verify caller is self or system admin
3. verify removing the user would not strand any team
4. verify removing the user would not strand any project
5. delete `Users_Sessions`
6. delete `Users_Projects_ProjectRoles`
7. delete `Users_Teams_TeamRoles`
8. delete `Users_Organizations_OrganizationRoles`
9. delete `Projects_Users`
10. delete `Teams_Users`
11. delete `Users_Organizations`
12. delete `Users_CredentialTypes`
13. delete `Users`

## Admin Self-Grant Rules

System admin does not bypass aggregate-ownership checks for destructive routes.

Current implemented self-grants:

- admin may self-grant direct `GGTC_TEAMROLE_TEAM_MANAGER` on any team
- admin may self-grant direct `GGTC_PROJECTROLE_PROJECT_MANAGER` on any project
- admin may self-grant direct `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER` on any organization

Those self-grants allow admin to take explicit ownership first. The later integrity checks still apply.
