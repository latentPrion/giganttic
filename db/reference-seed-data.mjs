const REFERENCE_SEED_DATA_BY_SCHEMA = {
  v1: {
    credentialTypes: [
      {
        allowsMultiplePerUser: false,
        code: "GGTC_CREDTYPE_USERNAME_PASSWORD",
        description: "Primary username/password login credential.",
        displayName: "Username and Password",
      },
    ],
    roles: [
      {
        code: "GGTC_ROLE_PROJECT_MANAGER",
        description: "Standard project management access within Giganttic.",
        displayName: "Project Manager",
      },
      {
        code: "GGTC_ROLE_ADMIN",
        description: "Full administrative access within Giganttic.",
        displayName: "Administrator",
      },
    ],
  },
  v2: {
    closedReasons: [
      {
        code: "ISSUE_CLOSED_REASON_WONTFIX",
        description: "Issue will not be fixed by product decision.",
        displayName: "Won't Fix",
      },
      {
        code: "ISSUE_CLOSED_REASON_CANTFIX",
        description: "Issue cannot be fixed within the current system constraints.",
        displayName: "Can't Fix",
      },
      {
        code: "ISSUE_CLOSED_REASON_RESOLVED",
        description: "Issue has been resolved.",
        displayName: "Resolved",
      },
    ],
    credentialTypes: [
      {
        allowsMultiplePerUser: false,
        code: "GGTC_CREDTYPE_USERNAME_PASSWORD",
        description: "Primary username/password login credential.",
        displayName: "Username and Password",
      },
    ],
    issueStatuses: [
      {
        code: "ISSUE_STATUS_OPEN",
        description: "Issue is open and actionable.",
        displayName: "Open",
      },
      {
        code: "ISSUE_STATUS_IN_PROGRESS",
        description: "Issue is actively being worked on.",
        displayName: "In Progress",
      },
      {
        code: "ISSUE_STATUS_CLOSED",
        description: "Issue has been closed.",
        displayName: "Closed",
      },
      {
        code: "ISSUE_STATUS_BLOCKED",
        description: "Issue is blocked pending external resolution.",
        displayName: "Blocked",
      },
    ],
    organizationRoles: [
      {
        code: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
        description: "Organization-scoped organization management access within Giganttic.",
        displayName: "Organization Manager",
      },
      {
        code: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        description:
          "Organization-scoped project management authority for projects associated to the organization.",
        displayName: "Project Manager",
      },
      {
        code: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        description:
          "Organization-scoped team management authority for teams assigned to the organization.",
        displayName: "Team Manager",
      },
    ],
    projectRoles: [
      {
        code: "GGTC_PROJECTROLE_PROJECT_MANAGER",
        description: "Project-scoped project management access within Giganttic.",
        displayName: "Project Manager",
      },
    ],
    systemRoles: [
      {
        code: "GGTC_SYSTEMROLE_ADMIN",
        description: "Full administrative access within Giganttic.",
        displayName: "Administrator",
      },
    ],
    teamRoles: [
      {
        code: "GGTC_TEAMROLE_TEAM_MANAGER",
        description: "Team-scoped team management access within Giganttic.",
        displayName: "Team Manager",
      },
      {
        code: "GGTC_TEAMROLE_PROJECT_MANAGER",
        description:
          "Team-scoped project management authority for projects reachable through the team.",
        displayName: "Project Manager",
      },
    ],
  },
  v3: {
    closedReasons: [
      {
        code: "ISSUE_CLOSED_REASON_WONTFIX",
        description: "Issue will not be fixed by product decision.",
        displayName: "Won't Fix",
      },
      {
        code: "ISSUE_CLOSED_REASON_CANTFIX",
        description: "Issue cannot be fixed within the current system constraints.",
        displayName: "Can't Fix",
      },
      {
        code: "ISSUE_CLOSED_REASON_RESOLVED",
        description: "Issue has been resolved.",
        displayName: "Resolved",
      },
    ],
    credentialTypes: [
      {
        allowsMultiplePerUser: false,
        code: "GGTC_CREDTYPE_USERNAME_PASSWORD",
        description: "Primary username/password login credential.",
        displayName: "Username and Password",
      },
    ],
    issueStatuses: [
      {
        code: "ISSUE_STATUS_OPEN",
        description: "Issue is open and actionable.",
        displayName: "Open",
      },
      {
        code: "ISSUE_STATUS_IN_PROGRESS",
        description: "Issue is actively being worked on.",
        displayName: "In Progress",
      },
      {
        code: "ISSUE_STATUS_CLOSED",
        description: "Issue has been closed.",
        displayName: "Closed",
      },
      {
        code: "ISSUE_STATUS_BLOCKED",
        description: "Issue is blocked pending external resolution.",
        displayName: "Blocked",
      },
    ],
    organizationRoles: [
      {
        code: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
        description: "Organization-scoped organization management access within Giganttic.",
        displayName: "Organization Manager",
      },
      {
        code: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        description:
          "Organization-scoped project management authority for projects associated to the organization.",
        displayName: "Project Manager",
      },
      {
        code: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        description:
          "Organization-scoped team management authority for teams assigned to the organization.",
        displayName: "Team Manager",
      },
    ],
    projectRoles: [
      {
        code: "GGTC_PROJECTROLE_PROJECT_MANAGER",
        description: "Project-scoped project management access within Giganttic.",
        displayName: "Project Manager",
      },
      {
        code: "GGTC_PROJECTROLE_PROJECT_OWNER",
        description: "Project-scoped ownership authority for destructive and membership-management actions.",
        displayName: "Project Owner",
      },
    ],
    systemRoles: [
      {
        code: "GGTC_SYSTEMROLE_ADMIN",
        description: "Full administrative access within Giganttic.",
        displayName: "Administrator",
      },
    ],
    teamRoles: [
      {
        code: "GGTC_TEAMROLE_TEAM_MANAGER",
        description: "Team-scoped team management access within Giganttic.",
        displayName: "Team Manager",
      },
      {
        code: "GGTC_TEAMROLE_PROJECT_MANAGER",
        description:
          "Team-scoped project management authority for projects reachable through the team.",
        displayName: "Project Manager",
      },
    ],
  },
};

function getReferenceSeedData(schemaName) {
  const referenceSeedData = REFERENCE_SEED_DATA_BY_SCHEMA[schemaName];

  if (!referenceSeedData) {
    throw new Error(`Unsupported schema for reference data reconciliation: ${schemaName}`);
  }

  return referenceSeedData;
}

export {
  getReferenceSeedData,
};
