const SEEDED_TEST_ACCOUNTS = {
  admin: {
    email: "testadminuser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU",
    plaintextPassword: "1234",
    seedKey: "user:admin",
    systemRoleCode: "GGTC_SYSTEMROLE_ADMIN",
    username: "testadminuser",
  },
  noRole: {
    email: "testnoroleuser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:noRole",
    systemRoleCode: null,
    username: "testnoroleuser",
  },
  orgOrganizationManager: {
    email: "testorgorgmanageruser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:orgOrganizationManager",
    systemRoleCode: null,
    username: "testorgorgmanageruser",
  },
  orgProjectManager: {
    email: "testorgprojectmanageruser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:orgProjectManager",
    systemRoleCode: null,
    username: "testorgprojectmanageruser",
  },
  orgTeamManager: {
    email: "testorgteammanageruser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:orgTeamManager",
    systemRoleCode: null,
    username: "testorgteammanageruser",
  },
  projectProjectManager: {
    email: "testprojectprojectmanageruser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:projectProjectManager",
    systemRoleCode: null,
    username: "testprojectprojectmanageruser",
  },
  teamProjectManager: {
    email: "testteamprojectmanageruser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:teamProjectManager",
    systemRoleCode: null,
    username: "testteamprojectmanageruser",
  },
  teamTeamManager: {
    email: "testteamteammanageruser@giganttic.com",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE",
    plaintextPassword: "1234",
    seedKey: "user:teamTeamManager",
    systemRoleCode: null,
    username: "testteamteammanageruser",
  },
};

const SEEDED_SCOPED_FIXTURES = {
  issues: {
    orgProjectManager: [
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Resolve remaining org-scoped authority edge cases before rollout.",
        journal: "Reproduced in seeded org fixture; needs regression coverage.",
        name: "Org-scoped PM regression sweep",
        openedAt: "2026-03-01T09:00:00.000Z",
        priority: 5,
        progressPercentage: 35,
        status: "ISSUE_STATUS_OPEN",
      },
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Blocked pending confirmation of upstream auth expectations.",
        journal: "Waiting on product clarification around transfer semantics.",
        name: "Project delegation clarifications",
        openedAt: "2026-03-02T10:15:00.000Z",
        priority: 3,
        progressPercentage: 20,
        status: "ISSUE_STATUS_BLOCKED",
      },
      {
        closedAt: "2026-03-04T16:45:00.000Z",
        closedReason: "ISSUE_CLOSED_REASON_RESOLVED",
        closedReasonDescription: "Seed fixture org/project associations now verified end to end.",
        description: "Track the completed org/project association verification pass.",
        journal: "Closed after backend integration tests were expanded.",
        name: "Verify org/project association seeding",
        openedAt: "2026-02-27T14:00:00.000Z",
        priority: 1,
        progressPercentage: 100,
        status: "ISSUE_STATUS_CLOSED",
      },
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Document sample organization PM issue priority ordering for downstream UI work.",
        journal: "Keeps the org project fixture useful for backlog sorting demos.",
        name: "Document org PM backlog ordering",
        openedAt: "2026-03-05T09:25:00.000Z",
        priority: 3,
        progressPercentage: 60,
        status: "ISSUE_STATUS_IN_PROGRESS",
      },
    ],
    projectProjectManager: [
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Direct PM fixture still needs polish on issue summary wording.",
        journal: "Summary preview should match final routed issue detail view.",
        name: "Polish direct PM issue previews",
        openedAt: "2026-03-01T11:30:00.000Z",
        priority: 3,
        progressPercentage: 55,
        status: "ISSUE_STATUS_OPEN",
      },
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Keep a blocked sample tied to the direct PM project for testing.",
        journal: "Blocked until downstream UI issue badges are finalized.",
        name: "Blocked UI badge alignment",
        openedAt: "2026-03-03T08:20:00.000Z",
        priority: 5,
        progressPercentage: 10,
        status: "ISSUE_STATUS_BLOCKED",
      },
      {
        closedAt: "2026-03-05T18:10:00.000Z",
        closedReason: "ISSUE_CLOSED_REASON_RESOLVED",
        closedReasonDescription: "Seed detail page now reflects update/delete authority correctly.",
        description: "Track completion of the direct PM detail-page acceptance criteria.",
        journal: "Closed after manual lobby-to-pm verification.",
        name: "Complete direct PM detail acceptance",
        openedAt: "2026-02-28T15:45:00.000Z",
        priority: 1,
        progressPercentage: 100,
        status: "ISSUE_STATUS_CLOSED",
      },
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Track a second open sample so direct-PM projects have a richer seeded backlog.",
        journal: "Useful for seeded list ordering and detail-page regression tests.",
        name: "Expand direct PM seeded backlog",
        openedAt: "2026-03-06T10:05:00.000Z",
        priority: 5,
        progressPercentage: 25,
        status: "ISSUE_STATUS_IN_PROGRESS",
      },
    ],
    teamProjectManager: [
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Team-derived PM fixture issue for route coverage.",
        journal: "Exercise team-derived manager access through seeded project-team link.",
        name: "Exercise team-derived PM route coverage",
        openedAt: "2026-03-02T13:00:00.000Z",
        priority: 5,
        progressPercentage: 40,
        status: "ISSUE_STATUS_OPEN",
      },
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Blocked sample for the team-derived project fixture.",
        journal: "Pending decision on cross-team notification routing.",
        name: "Cross-team notification routing",
        openedAt: "2026-03-03T09:40:00.000Z",
        priority: 3,
        progressPercentage: 15,
        status: "ISSUE_STATUS_BLOCKED",
      },
      {
        closedAt: "2026-03-06T12:00:00.000Z",
        closedReason: "ISSUE_CLOSED_REASON_RESOLVED",
        closedReasonDescription: "Team-derived fixture now seeds access and role rows correctly.",
        description: "Track completion of team-derived fixture bootstrapping.",
        journal: "Closed after seed validation and CRUD regression tests passed.",
        name: "Validate team-derived fixture bootstrapping",
        openedAt: "2026-02-26T17:25:00.000Z",
        priority: 1,
        progressPercentage: 100,
        status: "ISSUE_STATUS_CLOSED",
      },
      {
        closedAt: null,
        closedReason: null,
        closedReasonDescription: null,
        description: "Keep an extra routed-work sample on the team-derived project fixture.",
        journal: "Supports seeded demos for issue prioritization and PM issue routing.",
        name: "Seed team-derived routed work sample",
        openedAt: "2026-03-05T14:10:00.000Z",
        priority: 3,
        progressPercentage: 45,
        status: "ISSUE_STATUS_IN_PROGRESS",
      },
    ],
  },
  organizations: {
    orgOrganizationManager: {
      description: "Seeded org for organization-manager fixture coverage.",
      name: "Seed Fixture Organization Manager Org",
      seedKey: "organization:orgOrganizationManager",
    },
    orgProjectManager: {
      description: "Seeded org for organization-project-manager fixture coverage.",
      name: "Seed Fixture Organization Project Manager Org",
      seedKey: "organization:orgProjectManager",
    },
    orgTeamManager: {
      description: "Seeded org for organization-team-manager fixture coverage.",
      name: "Seed Fixture Organization Team Manager Org",
      seedKey: "organization:orgTeamManager",
    },
  },
  projects: {
    orgProjectManager: {
      description: "Seeded project managed through organization-scoped project authority.",
      name: "Seed Fixture Organization Project Managed Project",
      seedKey: "project:orgProjectManager",
    },
    projectProjectManager: {
      description: "Seeded project managed through direct project-scoped authority.",
      name: "Seed Fixture Direct Project Managed Project",
      seedKey: "project:projectProjectManager",
    },
    teamProjectManager: {
      description: "Seeded project managed through team-scoped project authority.",
      name: "Seed Fixture Team Project Managed Project",
      seedKey: "project:teamProjectManager",
    },
  },
  teams: {
    orgTeamManager: {
      description: "Seeded team managed through organization-scoped team authority.",
      name: "Seed Fixture Organization Team Managed Team",
      seedKey: "team:orgTeamManager",
    },
    teamProjectManager: {
      description: "Seeded team carrying team-scoped project-manager authority.",
      name: "Seed Fixture Team Project Managed Team",
      seedKey: "team:teamProjectManager",
    },
    teamTeamManager: {
      description: "Seeded team managed through direct team-scoped authority.",
      name: "Seed Fixture Direct Team Managed Team",
      seedKey: "team:teamTeamManager",
    },
  },
};

function getSeededTestData(schemaName) {
  if (schemaName !== "v2") {
    throw new Error(`Test data seeding is only supported for schema v2, received ${schemaName}.`);
  }

  return {
    seededScopedFixtures: SEEDED_SCOPED_FIXTURES,
    seededTestAccounts: SEEDED_TEST_ACCOUNTS,
  };
}

export {
  getSeededTestData,
  SEEDED_SCOPED_FIXTURES,
  SEEDED_TEST_ACCOUNTS,
};
