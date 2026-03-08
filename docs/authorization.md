# Authorization

This document describes the authorization rules currently implemented by the backend.

## Role Domains

System roles:
- `GGTC_SYSTEMROLE_ADMIN`

Organization roles:
- `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER`
- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER`

Project roles:
- `GGTC_PROJECTROLE_PROJECT_MANAGER`

Team roles:
- `GGTC_TEAMROLE_TEAM_MANAGER`
- `GGTC_TEAMROLE_PROJECT_MANAGER`

Notes:

- auth/session payload `user.roles` contains system roles only
- organization, project, and team roles are read from scoped mapping tables
- effective project-manager and effective team-manager authority are computed

## Auth and Session Routes

Routes:

- `POST /stc-proj-mgmt/api/auth/register`
- `POST /stc-proj-mgmt/api/auth/login`
- `GET /stc-proj-mgmt/api/auth/session/me`
- `GET /stc-proj-mgmt/api/auth/session?userId=...`
- `POST /stc-proj-mgmt/api/auth/session/revoke`

Rules:

- `register` and `login` are anonymous
- the session routes require bearer auth
- a user may view and revoke xeir own sessions
- `GGTC_SYSTEMROLE_ADMIN` may view and revoke other users' sessions

## Organizations

Routes:

- `POST /stc-proj-mgmt/api/organizations`
- `GET /stc-proj-mgmt/api/organizations`
- `GET /stc-proj-mgmt/api/organizations/:organizationId`
- `PATCH /stc-proj-mgmt/api/organizations/:organizationId`
- `PUT /stc-proj-mgmt/api/organizations/:organizationId/users`
- `PUT /stc-proj-mgmt/api/organizations/:organizationId/projects`
- `POST /stc-proj-mgmt/api/organizations/:organizationId/teams`
- `POST /stc-proj-mgmt/api/organizations/:organizationId/roles/grant`
- `POST /stc-proj-mgmt/api/organizations/:organizationId/roles/revoke`
- `DELETE /stc-proj-mgmt/api/organizations/:organizationId`

Creation and visibility:

- any authenticated user may create an organization
- creator is inserted into `Users_Organizations`
- creator is granted `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- `GET /organizations` is user-scoped for everyone, including `GGTC_SYSTEMROLE_ADMIN`
- users may list organizations where xe is:
  - a direct member
  - an indirect member through an org-owned team
  - or an org-role holder
- `GET /organizations/:organizationId` remains broader than the lobby list surface:
  - visible to org members under the rules above
  - also visible to `GGTC_SYSTEMROLE_ADMIN`
- broad admin discovery is intentionally deferred to a separate future admin SPA;
  the current lobby is a normal user view even for admins

Management authority:

- `PATCH`, `PUT /users`, `PUT /projects`, `POST /teams`, and org-role grant/revoke require:
  - `GGTC_SYSTEMROLE_ADMIN`, or
  - `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER` on that organization
- `DELETE /organizations/:organizationId` requires direct `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- `GGTC_SYSTEMROLE_ADMIN` may self-grant `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER` on any org and then delete it
- org deletion is still blocked while the org owns any team
- direct project associations do not block org deletion by themselves; they block only if deleting the org would remove the final effective project-manager coverage for a directly associated project

Org-role targeting rules:

- org-role targets must already be organization members
- membership may be direct or indirect through an org-owned team
- exception: system admin self-grant of org manager auto-adds direct org membership if needed

Current org-role grant surface:

- public org-role grant/revoke endpoints manage organization roles only
- they do not directly grant project roles or team roles

## Teams

Routes:

- `POST /stc-proj-mgmt/api/teams`
- `GET /stc-proj-mgmt/api/teams`
- `GET /stc-proj-mgmt/api/teams/:teamId`
- `PATCH /stc-proj-mgmt/api/teams/:teamId`
- `PUT /stc-proj-mgmt/api/teams/:teamId/members`
- `POST /stc-proj-mgmt/api/teams/:teamId/roles/grant`
- `POST /stc-proj-mgmt/api/teams/:teamId/roles/revoke`
- `DELETE /stc-proj-mgmt/api/teams/:teamId`

Creation and visibility:

- any authenticated user may create a team
- creator is inserted into `Teams_Users`
- creator is granted `GGTC_TEAMROLE_TEAM_MANAGER`
- `GET /teams` is user-scoped for everyone, including `GGTC_SYSTEMROLE_ADMIN`
- users may list only teams where they are members
- `GET /teams/:teamId` remains accessible to `GGTC_SYSTEMROLE_ADMIN`
- broad admin discovery is intentionally deferred to a separate future admin SPA;
  the current lobby remains membership-scoped

Effective team-manager authority means:

- direct `GGTC_TEAMROLE_TEAM_MANAGER` on that team, or
- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` on the organization that owns the team

Management rules:

- `PATCH /teams/:teamId`, `PUT /teams/:teamId/members`, and `DELETE /teams/:teamId` require effective team-manager authority
- system admin may self-grant `GGTC_TEAMROLE_TEAM_MANAGER` on any team, which also auto-adds team membership if needed

Role grant and revoke rules:

- `GGTC_TEAMROLE_TEAM_MANAGER` grant/revoke requires:
  - `GGTC_SYSTEMROLE_ADMIN`, or
  - effective team-manager authority
- `GGTC_TEAMROLE_PROJECT_MANAGER` grant/revoke requires:
  - direct `GGTC_TEAMROLE_PROJECT_MANAGER` on that same team, or
  - for grant only, `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` on the owning organization when the team is linked to at least one project
- team-role targets must already be team members
- exceptions:
  - system admin self-grant of `GGTC_TEAMROLE_TEAM_MANAGER` may auto-add admin as a member
  - org team manager may bootstrap team membership when granting `GGTC_TEAMROLE_TEAM_MANAGER` to an org member on an org-owned team

Team invariants:

- membership replacement is full replacement
- member rows must be unique by `userId`
- each submitted member's `roleCodes` must be unique
- all submitted users must exist
- a team must retain at least one effective team manager unless the team itself is being deleted
- deleting a team is blocked if that delete would strand any linked project without an effective project manager

## Projects

Routes:

- `POST /stc-proj-mgmt/api/projects`
- `GET /stc-proj-mgmt/api/projects`
- `GET /stc-proj-mgmt/api/projects/:projectId`
- `PATCH /stc-proj-mgmt/api/projects/:projectId`
- `PUT /stc-proj-mgmt/api/projects/:projectId/members`
- `POST /stc-proj-mgmt/api/projects/:projectId/roles/grant`
- `POST /stc-proj-mgmt/api/projects/:projectId/roles/revoke`
- `DELETE /stc-proj-mgmt/api/projects/:projectId`

Visibility:

- any authenticated user may create a project
- creator is inserted into `Projects_Users`
- creator is granted `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `GET /projects` is user-scoped for everyone, including `GGTC_SYSTEMROLE_ADMIN`
- users may list or fetch a project if xe has:
  - direct membership through `Projects_Users`, or
  - indirect access through `Teams_Users` plus `Projects_Teams`
- `GET /projects/:projectId` is also visible to `GGTC_SYSTEMROLE_ADMIN`
- broad admin discovery is intentionally deferred to a separate future admin SPA;
  the current lobby remains association-scoped

Effective project-manager authority means:

- direct `GGTC_PROJECTROLE_PROJECT_MANAGER` on the project
- `GGTC_TEAMROLE_PROJECT_MANAGER` on a linked team
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER` on an organization directly associated to the project
- `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER` on an organization that owns a linked team

It explicitly does not include:

- `GGTC_ORGANIZATIONROLE_TEAM_MANAGER` by itself

Management rules:

- `PATCH /projects/:projectId`, `PUT /projects/:projectId/members`, `POST /roles/grant`, `POST /roles/revoke`, and `DELETE` require effective project-manager authority
- `GGTC_SYSTEMROLE_ADMIN` may self-grant direct `GGTC_PROJECTROLE_PROJECT_MANAGER` on any project and then delete it

Project-role targeting rules:

- direct project roles require direct project membership
- exception: system admin self-grant of direct project-manager may auto-add direct membership

Project-role grant rules:

- any effective project manager may grant and revoke direct `GGTC_PROJECTROLE_PROJECT_MANAGER`
- a user who is only an org team manager may also grant direct `GGTC_PROJECTROLE_PROJECT_MANAGER` on eligible projects
- a team-scoped project manager may grant direct project-manager to a direct member outside the team
- there is no public API for mutating `Projects_Teams`

Project invariants:

- direct membership replacement is full replacement
- member rows must be unique by `userId`
- each submitted member's `roleCodes` must be unique
- all submitted users must exist
- the project must retain at least one effective project manager after direct membership replacement or direct project-role revoke

## Users

Route:

- `DELETE /stc-proj-mgmt/api/users/:userId`

Rules:

- a user may delete themself
- `GGTC_SYSTEMROLE_ADMIN` may delete another user
- deletion is blocked if the target user is the final effective project manager for any project
- deletion is blocked if the target user is the final effective team manager for any team
- these checks apply to both self-delete and admin-delete
