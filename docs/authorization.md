# Authorization

This document describes the backend authorization and role-transfer rules
currently implemented for auth/session, teams, projects, and user deletion.

## Core Role Domains

Current role namespaces:

- `GGTC_SYSTEMROLE_ADMIN`
- `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_TEAMROLE_PROJECT_MANAGER`

Important distinction:

- auth/session payload `user.roles` contains system roles only
- project and team role checks are evaluated from scoped assignment tables
- effective project-manager authority is computed, not stored

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
- `GGTC_SYSTEMROLE_ADMIN` may view or revoke sessions for other users

## Teams

Current team routes:

- `POST /stc-proj-mgmt/api/teams`
- `GET /stc-proj-mgmt/api/teams`
- `GET /stc-proj-mgmt/api/teams/:teamId`
- `PATCH /stc-proj-mgmt/api/teams/:teamId`
- `PUT /stc-proj-mgmt/api/teams/:teamId/members`
- `POST /stc-proj-mgmt/api/teams/:teamId/roles/grant`
- `POST /stc-proj-mgmt/api/teams/:teamId/roles/revoke`
- `DELETE /stc-proj-mgmt/api/teams/:teamId`

### Team creation and visibility

- any authenticated user may create a team
- the creator is automatically inserted into `Teams_Users`
- the creator is automatically granted `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_SYSTEMROLE_ADMIN` may list and fetch any team
- non-admin users may list and fetch only teams where they are members

### Team management authority

- `PATCH /teams/:teamId` and `PUT /teams/:teamId/members` require either:
  - `GGTC_SYSTEMROLE_ADMIN`, or
  - direct `GGTC_TEAMROLE_TEAM_MANAGER` on that team
- `DELETE /teams/:teamId` requires direct `GGTC_TEAMROLE_TEAM_MANAGER`
- system admin may explicitly self-grant `GGTC_TEAMROLE_TEAM_MANAGER` on any
  team and then use that direct ownership to delete it
- `POST /teams/:teamId/roles/grant` and `.../revoke` use role-specific rules:
  - `GGTC_TEAMROLE_TEAM_MANAGER` grant/revoke requires system admin or direct
    `GGTC_TEAMROLE_TEAM_MANAGER`
  - `GGTC_TEAMROLE_PROJECT_MANAGER` grant/revoke requires direct
    `GGTC_TEAMROLE_PROJECT_MANAGER` on that same team

### Team invariants

- membership replacement is full replacement, not incremental patching
- every submitted member must refer to an existing user
- team member entries must be unique by `userId`
- each submitted member's `roleCodes` must be unique
- a team must always retain at least one `GGTC_TEAMROLE_TEAM_MANAGER`
- a team role target must already be a team member, except system admin
  self-grant of `GGTC_TEAMROLE_TEAM_MANAGER`, which auto-adds admin as a member
- deleting a team is blocked if removing that team would eliminate the final
  effective project manager for any linked project

## Projects

Current project routes:

- `POST /stc-proj-mgmt/api/projects`
- `GET /stc-proj-mgmt/api/projects`
- `GET /stc-proj-mgmt/api/projects/:projectId`
- `PATCH /stc-proj-mgmt/api/projects/:projectId`
- `PUT /stc-proj-mgmt/api/projects/:projectId/members`
- `POST /stc-proj-mgmt/api/projects/:projectId/roles/grant`
- `POST /stc-proj-mgmt/api/projects/:projectId/roles/revoke`
- `DELETE /stc-proj-mgmt/api/projects/:projectId`

### Effective project-manager authority

A user is treated as an effective project manager for a project if xe has either:

- direct `GGTC_PROJECTROLE_PROJECT_MANAGER` on that project, or
- `GGTC_TEAMROLE_PROJECT_MANAGER` on a team linked to that project through
  `Projects_Teams`

This effective authority is used for currently supported project-management
operations.

### Project creation and visibility

- any authenticated user may create a project
- the creator is automatically inserted into `Projects_Users`
- the creator is automatically granted `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `GGTC_SYSTEMROLE_ADMIN` may list and fetch any project
- non-admin users may fetch a project if xe has direct access through
  `Projects_Users` or indirect access through `Teams_Users` plus `Projects_Teams`

### Project management authority

- `PATCH /projects/:projectId`, `PUT /projects/:projectId/members`,
  `POST /projects/:projectId/roles/grant`, and
  `POST /projects/:projectId/roles/revoke` require either:
  - `GGTC_SYSTEMROLE_ADMIN`, or
  - effective project-manager authority
- `DELETE /projects/:projectId` requires effective project-manager authority
- system admin may explicitly self-grant direct
  `GGTC_PROJECTROLE_PROJECT_MANAGER` on any project and then use that direct
  ownership to delete it

### Project invariants

- direct membership replacement is full replacement
- every submitted member must refer to an existing user
- project member entries must be unique by `userId`
- each submitted member's `roleCodes` must be unique
- the project must always retain at least one effective project manager after a
  direct-membership or direct-role change
- a direct project-role target must already be a direct project member, except
  system admin self-grant of direct project-manager, which auto-adds admin as a
  direct member
- a direct last project manager may be removed if at least one linked-team
  project manager still remains

### Asymmetrical grant rules

- an effective project manager may grant direct
  `GGTC_PROJECTROLE_PROJECT_MANAGER`
- a team-scoped project manager may grant direct project-manager to a user
  outside that team, as long as that user already has direct project membership
- direct project-manager alone may not grant `GGTC_TEAMROLE_PROJECT_MANAGER`
- there is currently no public API that mutates `Projects_Teams`

## Users

Current user route:

- `DELETE /stc-proj-mgmt/api/users/:userId`

Authorization and integrity rules:

- a user may delete themself
- `GGTC_SYSTEMROLE_ADMIN` may delete another user
- neither self-delete nor admin-delete may remove the final remaining:
  - effective project manager for any project
  - `GGTC_TEAMROLE_TEAM_MANAGER` for any team
- deletion succeeds only after management responsibility has been transferred
