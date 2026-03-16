# Auth model

Objects which need to be controlled:
* Projects, Teams, Organizations.
Object to which authorities are attached (via roles):
* Users.

Problems to be guarded against:
* Unauthorized privileged actions.
* Orphaned rows and Unmanaged Objects.
* Rogue, but permissible actions by a Rogue Manager, eventually.

Role-permissions which need to be decided:
* Role minting.
* Project membership association/dissociation into Users, Teams and Organizations.

# Preventing orphaned rows & unmanaged objects:

## Projects:
### Deleting Projects:
Projects can be deleted at any time by any PROJECT_PROJECT_OWNER on that Project.
* It's fine for Project Managers to exist while having no Projects currently under their management. The inverse isn't true: it's not fine for Projects to exist with no Project Manager who can garbage clean them.

## Users:
### Deleting users:
Users can't be deleted if they're the last PROJECT_PROJECT_OWNER for any Project.

Users can't be deleted if they're the last effective Project Manager for any Project. Effective Project Manager means:
* User has a direct PROJECT_PROJECT_MANAGER role association with that project. I.e: Users_Projects_ProjectRoles associates that User with that Project and includes PROJECT_PROJECT_MANAGER.
* User has a Team-based TEAM_PROJECT_MANAGER role association with that Project. I.e: Users_Teams_TeamRoles assigns that user TEAM_PROJECT_MANAGER; and the same Team also has membership association with the Project in question via Projects_Teams.
* User has an Org-based ORGANIZATION_PROJECT_MANAGER role association with that Project. I.e: Users_Organizations_OrganizationRoles assigns that user ORGANIZATION_PROJECT_MANAGER; and the same Org also has membership association with the Project in question via Projects_Organizations.

Users can't be deleted if they're the last effective Team Manager for any Team. Effective Project Manager means:
* User is a Team-level Team Manager for that team. I.e: Users_Teams_TeamRoles has an entry which maps Users.id + Teams.id and assigns TEAMS_TEAM_MANAGER to that user, for that combination of Users.id + Teams.id.
* User is an Org-level Team Manager for that team. I.e: Users_Organizations_OrganizationsRoles has an entry which maps Users.id + Organizations.id and assigns ORGANIZATION_TEAM_MANAGER to that user; AND, that Team is a member of that Organization via Organizations_Teams.

Users can't be deleted if they're the last effective Org Manager for any Org:
* User is an Org Manager for that Org. I.e: Users_Organizations_OrganizationRoles has an entry which maps Users.id + Organizations.id and assigns ORGANIZATION_ORGANIZATION_MANAGER to that user, for that combination of Users.id + Organizations.id.

### Removing roles from users:
A user cannot have the PROJECT_PROJECT_MANAGER, TEAM_PROJECT_MANAGER or ORGANIZATION_PROJECT_MANAGER removed from xis roles for a given Project, Team or Organization, if removing that role would eliminate the last effective Project Manager for any Project:

* A User cannot have the PROJECT_PROJECT_OWNER role removed from xis roles for a given Project, if xe is the last remaining PROJECT_PROJECT_OWNER for that Project.

A User cannot have the TEAM_TEAM_MANAGER or ORG_TEAM_MANAGER role removed from xis roles for a given Project, Team or Organization, if removing that role would eliminate the last effective Team Manager for any Team.

A user cannot have the ORG_ORG_MANAGER role removed from xis roles for a given Org, if removing that role would eliminate the last effective Org Manager for any Organization.

## Teams:
### Deleting Teams:
A Team cannot be deleted if doing so would cause the TEAM_PROJECT_MANAGER role to be deleted from a user, and where that user is the final effective Project Manager for any Project.

## Organizations
### Deleting Organizations:

An Organization cannot be deleted if doing so would cause the ORG_PROJECT_MANAGER role to be deleted from a User, and where that User is the final effective Project Manager for any Project.

An Organization cannot be deleted if doing so would cause the ORG_TEAM_MANAGER role to be deleted from a User, and where that User is the final effective Team Manager for any Team.

# Auth:

## Unprivileged access is implied by membership association:
* Any User who is a direct Member of a Project (Projects_Users) can see and have unprivileged interactions with that Project.
* Any User who is a member of a Team which is associated with a Project (Project_Teams + Users_Teams dual association) can see and have unprivileged interactions with that Project.
* Any Users who is a member of an Organization which is associated with a Project (Projects_Organizations + Users_Organizations) can see and have unprivileged interactions with that Project.

## Privileged

# Auth minting:

In all cases where a User is minted a privileged Role on a Project, that User is auto assigned a Membership association with that Project, if they weren't already previously associated (directly, or indirectly via Team/Org).
* The same does not apply to Teams. A User can be granted a TEAM_TEAM_MANAGER or TEAM_PROJECT_MANAGER role on a Team, yet remain a non-Membership-associated User wrt that Team.
* Similarly, the same does not apply to Orgs. A User can be granted an ORG_TEAM_MANAGER or ORG_PROJECT_MANAGER role on an Org, yet remain a non-Membership-associated User wrt that Org.

## Org Manager can mint Org+Team Project Manager:
* This is fine and expected. Org manager controls all project manager authorities within the org.
* But what about teams without an org? An orgless team has no way to originate a Project Manager currently.

## Org Manager can mint Org+Team Team Manager:
* This is also fine and expected. Org manager controls all teams within the org.

## Can Team Manager mint Project Manager?:
* Can a Team Manager mint and assign the TEAM_PROJECT_MANAGER role to any member of xis team? In which case, holding TEAM_TEAM_MANAGER is effectively the same as holding TEAM_PROJECT_MANAGER.
  * Yes.
* Can an Org Team Manager mint and assign the ORG_PROJECT_MANAGER role, or the TEAM_PROJECT_MANAGER role to any member of xis org? In which case, holding ORG_TEAM_MANAGER is effectively the same as holding ORG_PROJECT_MANAGER and TEAM_PROJECT_MANAGER.
  * Org Team Manager canNOT mint and assign ORG_PROJECT_MANAGER. Only ORG_ORG_MANAGER can do this.
  * Org Team Manager can mint and assign TEAM_TEAM_MANAGER.
  * Org Team Manager can mint and assign TEAM_PROJECT_MANAGER.
* Can a Team/Org Team Manager mint and assign PROJECT_PROJECT_MANAGER to any User directly?
  * Yes. TEAM_TEAM_MANAGER and ORG_TEAM_MANAGER can mint and assign PROJECT_PROJECT_MANAGER to any User, even if they're outside of the team/Organization. This will necessarily auto-add said User as a Membership association to that Project if they weren't previously associated (whther directly, or indirectly via Team/Org association).
* If neither of these, then where does TEAM/ORG_PROJECT_MANAGER originate from? It's already fixed that PROJECT_PROJECT_MANAGER originates and fixes in the User who creates the Project. But no path exists for a TEAM_PROJECT_MANAGER to originate.
  * TEAM_PROJECT_MANAGER originates from either a TEAM_TEAM_MANAGER or an ORG_TEAM_MANAGER.
  * ORG_PROJECT_MANAGER originates ONLY from the ORG_ORG_MANAGER.

## Can Team Manager mint Team Manager?:
* Can a Team Manager mint and assign the TEAM_TEAM_MANAGER role to any member of xis team?
  * Yes.
* Can an Org Team Manager mint and assign the ORG_TEAM_MANAGER role, or the TEAM_TEAM_MANAGER role to any member of xis org?
  * An Org Team Manager canNOT mint and assign ORG_TEAM_MANAGER. Only ORG_ORG_MANAGER can do this.
  * An Org Team Manager can mint and assign TEAM_TEAM_MANAGER.

## Can Project Manager mint Project Manager?:
* Can an effective Project Manager delete a Project that xe is associated with?
  * No. Permission to delete a Project is vested only in PROJECT_PROJECT_OWNER.
* Can a Team Project Manager mint and assign the TEAM_PROJECT_MANAGER role to any member of xis team?
  * No. No *_PROJECT_MANAGER can mint and assign their role to another user.
  * Ergo: TEAM_PROJECT_MANAGER cannot mint and assign TEAM_PROJECT_MANAGER.
  * To make it abundantly clear: TEAM_PROJECT_MANAGER also cannot mint and assign PROJECT_PROJECT_MANAGER to a User.
* Can an Org Project Manager mint and assign the ORG_PROJECT_MANAGER role to any member of his org; or the TEAM_PROJECT_MANAGER to any member of a team in his org?
  * No. No project Manager can mint and assign their role.
  * Ergo: ORG_PROJECT_MANAGER cannot mint and assign ORG_PROJECT_MANAGER or TEAM_PROJECT_MANAGER.

# Membership Association/Dissociation:

We will now a new ProjectRole, called "PROJECT_PROJECT_OWNER".
After a new Project is created, its creator is assigned both PROJECT_PROJECT_MANAGER and PROJECT_PROJECT_OWNER for that Project.

* This role is only assignable to Users, qua Users.
  * There is no homologuous "OWNER" role for Teams or Orgs at the moment, and none is planned.
* This role can delete a Project.
* This role can also control and edit Membership associations.
  * I.e: This role can add/remove a Team to/from a Project.
  * This role can add/remove an Org to/from a Project.
  * This role can add/remove a User to/from a Project.

## Grant/Revoke PROJECT_OWNER?:

PROJECT_PROJECT_OWNER for a given Project can be granted to another User by any current PROJECT_PROJECT_OWNER for that Project.

Revocation is flat and non-hierarchical, at least for now. So one PROJECT_PROJECT_OWNER can revoke the rights from another.
* No PROJECT_PROJECT_OWNER can revoke PROJECT_PROJECT_OWNER from himself for a given Project, IFF he is the last remaining PROJECT_PROJECT_OWNER for that Project.
* Eventually we'll implement consensus vote for revocation.

At first for now, the PROJECT_PROJECT_OWNER adds/removes Teams/Orgs to/from xis Project unilaterally. In time we'll make it an "invitation" so that the Team/Org Managers can consent or decline. But that feature adds complexity which we're not trying to implement right now.

# Team Manager powers:
Effective Team Manager can:
* Add/remove Team membership associations for Users, to a Team.
* Cannot Add/remove Team membership associations for Projects, to a Team. For now, at least. We'll add some kind of consent mechanism here whereby the effective Team Managers can vote or something to accept/reject an incoming Project.

# Org Manager powers:
Org Manager can:
* Add/remove Team membership associations to/from xis Organization.
  * N.B: This isn't the same as creating a Team. Any User can create a Team. The unique power here is for an Org Manager to add a given, pre-existing team to xis Org.
* Add/remove User membership associations to/from xis Organization.
* Cannot add/remove Org membership associations for Projects, to xis Org. For now at least. We'll add something here later.

# Rogue Manager QoL controls:

* The important actions of a Manager may be subjected to a consensus vote among all peer Managers.
  * E.g: Adding/Removing a Team Member will first create a vote among all current effective Team Managers for that Team. If a majority agrees, then the action will continue. Else, it won't.
* This is a feature for addition later.

# Admin auth:

Admins must self-grant a role before they can take actions with respect to an object which requires that role. This keeps the auth system simple.
* Admins may indeed self-grant PROJECT_PROJECT_OWNER.
* Admins may self-grant TEAM_TEAM_MANAGER and ORG_ORG_MANAGER.
