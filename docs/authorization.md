# Authorization

This document describes the authorization rules currently implemented in the
backend for auth/session, teams, and projects.

## Core Role Domains

Current role namespaces:

- `GGTC_SYSTEMROLE_ADMIN`
- `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_TEAMROLE_PROJECT_MANAGER`

Important distinction:

- auth/session payload `user.roles` currently contains system roles only
- project and team role checks are evaluated from their own scoped assignment
  tables, not from `user.roles`

## Session and Auth Routes

Current auth routes:

- `POST /stc-proj-mgmt/api/auth/register`
- `POST /stc-proj-mgmt/api/auth/login`
- `GET /stc-proj-mgmt/api/auth/session/me`
- `GET /stc-proj-mgmt/api/auth/session?userId=...`
- `POST /stc-proj-mgmt/api/auth/session/revoke`

Authorization rules:

- `register` and `login` are anonymous routes
- `session/me`, `session`, and `session/revoke` require bearer auth
- a user may view or revoke xeir own sessions
- a user with `GGTC_SYSTEMROLE_ADMIN` may view or revoke sessions for other
  users
- non-admin users may not manage other users' sessions

## Teams

Current team routes:

- `POST /stc-proj-mgmt/api/teams`
- `GET /stc-proj-mgmt/api/teams`
- `GET /stc-proj-mgmt/api/teams/:teamId`
- `PATCH /stc-proj-mgmt/api/teams/:teamId`
- `PUT /stc-proj-mgmt/api/teams/:teamId/members`
- `DELETE /stc-proj-mgmt/api/teams/:teamId`

### Team creation

- any authenticated user may create a team
- the creator is automatically inserted into `Teams_Users`
- the creator is automatically granted
  `GGTC_TEAMROLE_TEAM_MANAGER` in `Users_Teams_TeamRoles`

### Team visibility

- a user with `GGTC_SYSTEMROLE_ADMIN` may list and fetch any team
- a non-admin user may list only teams where xe is a member
- a non-admin user may fetch a team only if xe is a member of that team

### Team update and deletion

- `PATCH /teams/:teamId` requires either:
  - `GGTC_SYSTEMROLE_ADMIN`, or
  - `GGTC_TEAMROLE_TEAM_MANAGER` for that team
- `PUT /teams/:teamId/members` requires the same authorization
- `DELETE /teams/:teamId` requires the same authorization

### Team membership invariants

- membership replacement is full replacement, not incremental patching
- every submitted member must refer to an existing user
- team member entries must be unique by `userId`
- each submitted member's `roleCodes` array must not contain duplicates
- after a membership update, the team must still contain at least one
  `GGTC_TEAMROLE_TEAM_MANAGER`
- removing the last team manager is rejected
- this last-manager rule is intentionally bypassed when deleting the team
  itself, because delete operates on the parent row and lets the DB cascade

## Projects

Current project routes:

- `POST /stc-proj-mgmt/api/projects`
- `GET /stc-proj-mgmt/api/projects`
- `GET /stc-proj-mgmt/api/projects/:projectId`
- `PATCH /stc-proj-mgmt/api/projects/:projectId`
- `PUT /stc-proj-mgmt/api/projects/:projectId/members`
- `DELETE /stc-proj-mgmt/api/projects/:projectId`

### Project creation

- any authenticated user may create a project
- the creator is automatically inserted into `Projects_Users`
- the creator is automatically granted
  `GGTC_PROJECTROLE_PROJECT_MANAGER` in
  `Users_Projects_ProjectRoles`

### Project visibility

- a user with `GGTC_SYSTEMROLE_ADMIN` may list and fetch any project
- a non-admin user may access a project if xe has direct access through
  `Projects_Users`
- a non-admin user may also access a project if xe belongs to a team in
  `Teams_Users` and that team is connected to the project through
  `Projects_Teams`

### Project update and deletion

- `PATCH /projects/:projectId` requires either:
  - `GGTC_SYSTEMROLE_ADMIN`, or
  - `GGTC_PROJECTROLE_PROJECT_MANAGER` for that project
- `PUT /projects/:projectId/members` requires the same authorization
- `DELETE /projects/:projectId` requires the same authorization

### Project membership invariants

- membership replacement is full replacement, not incremental patching
- every submitted member must refer to an existing user
- project member entries must be unique by `userId`
- each submitted member's `roleCodes` array must not contain duplicates
- after a membership update, the project must still contain at least one
  `GGTC_PROJECTROLE_PROJECT_MANAGER`
- removing the last project manager is rejected
- this last-manager rule is intentionally bypassed when deleting the project
  itself, because delete operates on the parent row and lets the DB cascade

## Functional Equivalence Note

`GGTC_TEAMROLE_PROJECT_MANAGER` is intended to be functionally relevant to
project management at the product level, but the current backend CRUD
authorization implemented today does not use it for project update/delete
authorization. Current project-management route checks rely on:

- `GGTC_SYSTEMROLE_ADMIN`, or
- `GGTC_PROJECTROLE_PROJECT_MANAGER` for the target project

If team-scoped project-manager equivalence is later enforced in runtime
authorization, this document should be updated along with the relevant tests.
