const SEEDED_EMAIL_DOMAIN = "giganttic.com";
const SEEDED_PLAINTEXT_PASSWORD = "1234";
const SEEDED_CLOSED_REASON_RESOLVED = "ISSUE_CLOSED_REASON_RESOLVED";
const SEEDED_ISSUE_STATUS_BLOCKED = "ISSUE_STATUS_BLOCKED";
const SEEDED_ISSUE_STATUS_CLOSED = "ISSUE_STATUS_CLOSED";
const SEEDED_ISSUE_STATUS_OPEN = "ISSUE_STATUS_OPEN";
const SEEDED_PRIORITY_LOW = 1;
const SEEDED_PRIORITY_MEDIUM = 3;
const SEEDED_PRIORITY_HIGH = 5;
const ADMIN_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU";
const SHARED_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE";

function createSeededIssue(seed: {
  closedAt?: string;
  closedReason?: string;
  closedReasonDescription?: string | null;
  description?: string | null;
  journal?: string | null;
  name: string;
  openedAt: string;
  priority: number;
  progressPercentage: number;
  status: string;
}) {
  return {
    closedAt: seed.closedAt ?? null,
    closedReason: seed.closedReason ?? null,
    closedReasonDescription: seed.closedReasonDescription ?? null,
    description: seed.description ?? null,
    journal: seed.journal ?? null,
    name: seed.name,
    openedAt: seed.openedAt,
    priority: seed.priority,
    progressPercentage: seed.progressPercentage,
    status: seed.status,
  };
}

function createSeededAccount(username: string) {
  return {
    email: `${username}@${SEEDED_EMAIL_DOMAIN}`,
    passwordHash: SHARED_PASSWORD_HASH,
    plaintextPassword: SEEDED_PLAINTEXT_PASSWORD,
    username,
  };
}

export const seededTestAccounts = {
  admin: {
    email: "testadminuser@giganttic.com",
    passwordHash: ADMIN_PASSWORD_HASH,
    plaintextPassword: SEEDED_PLAINTEXT_PASSWORD,
    username: "testadminuser",
  },
  noRole: createSeededAccount("testnoroleuser"),
  orgOrganizationManager: createSeededAccount("testorgorgmanageruser"),
  orgProjectManager: createSeededAccount("testorgprojectmanageruser"),
  orgTeamManager: createSeededAccount("testorgteammanageruser"),
  projectProjectManager: createSeededAccount("testprojectprojectmanageruser"),
  teamProjectManager: createSeededAccount("testteamprojectmanageruser"),
  teamTeamManager: createSeededAccount("testteamteammanageruser"),
} as const;

export const seededScopedFixtures = {
  issues: {
    orgProjectManager: [
      createSeededIssue({
        description: "Resolve remaining org-scoped authority edge cases before rollout.",
        journal: "Reproduced in seeded org fixture; needs regression coverage.",
        name: "Org-scoped PM regression sweep",
        openedAt: "2026-03-01T09:00:00.000Z",
        priority: SEEDED_PRIORITY_HIGH,
        progressPercentage: 35,
        status: SEEDED_ISSUE_STATUS_OPEN,
      }),
      createSeededIssue({
        description: "Blocked pending confirmation of upstream auth expectations.",
        journal: "Waiting on product clarification around transfer semantics.",
        name: "Project delegation clarifications",
        openedAt: "2026-03-02T10:15:00.000Z",
        priority: SEEDED_PRIORITY_MEDIUM,
        progressPercentage: 20,
        status: SEEDED_ISSUE_STATUS_BLOCKED,
      }),
      createSeededIssue({
        closedAt: "2026-03-04T16:45:00.000Z",
        closedReason: SEEDED_CLOSED_REASON_RESOLVED,
        closedReasonDescription: "Seed fixture org/project associations now verified end to end.",
        description: "Track the completed org/project association verification pass.",
        journal: "Closed after backend integration tests were expanded.",
        name: "Verify org/project association seeding",
        openedAt: "2026-02-27T14:00:00.000Z",
        priority: SEEDED_PRIORITY_LOW,
        progressPercentage: 100,
        status: SEEDED_ISSUE_STATUS_CLOSED,
      }),
    ],
    projectProjectManager: [
      createSeededIssue({
        description: "Direct PM fixture still needs polish on issue summary wording.",
        journal: "Summary preview should match final routed issue detail view.",
        name: "Polish direct PM issue previews",
        openedAt: "2026-03-01T11:30:00.000Z",
        priority: SEEDED_PRIORITY_MEDIUM,
        progressPercentage: 55,
        status: SEEDED_ISSUE_STATUS_OPEN,
      }),
      createSeededIssue({
        description: "Keep a blocked sample tied to the direct PM project for testing.",
        journal: "Blocked until downstream UI issue badges are finalized.",
        name: "Blocked UI badge alignment",
        openedAt: "2026-03-03T08:20:00.000Z",
        priority: SEEDED_PRIORITY_HIGH,
        progressPercentage: 10,
        status: SEEDED_ISSUE_STATUS_BLOCKED,
      }),
      createSeededIssue({
        closedAt: "2026-03-05T18:10:00.000Z",
        closedReason: SEEDED_CLOSED_REASON_RESOLVED,
        closedReasonDescription: "Seed detail page now reflects update/delete authority correctly.",
        description: "Track completion of the direct PM detail-page acceptance criteria.",
        journal: "Closed after manual lobby-to-pm verification.",
        name: "Complete direct PM detail acceptance",
        openedAt: "2026-02-28T15:45:00.000Z",
        priority: SEEDED_PRIORITY_LOW,
        progressPercentage: 100,
        status: SEEDED_ISSUE_STATUS_CLOSED,
      }),
    ],
    teamProjectManager: [
      createSeededIssue({
        description: "Team-derived PM fixture issue for route coverage.",
        journal: "Exercise team-derived manager access through seeded project-team link.",
        name: "Exercise team-derived PM route coverage",
        openedAt: "2026-03-02T13:00:00.000Z",
        priority: SEEDED_PRIORITY_HIGH,
        progressPercentage: 40,
        status: SEEDED_ISSUE_STATUS_OPEN,
      }),
      createSeededIssue({
        description: "Blocked sample for the team-derived project fixture.",
        journal: "Pending decision on cross-team notification routing.",
        name: "Cross-team notification routing",
        openedAt: "2026-03-03T09:40:00.000Z",
        priority: SEEDED_PRIORITY_MEDIUM,
        progressPercentage: 15,
        status: SEEDED_ISSUE_STATUS_BLOCKED,
      }),
      createSeededIssue({
        closedAt: "2026-03-06T12:00:00.000Z",
        closedReason: SEEDED_CLOSED_REASON_RESOLVED,
        closedReasonDescription: "Team-derived fixture now seeds access and role rows correctly.",
        description: "Track completion of team-derived fixture bootstrapping.",
        journal: "Closed after seed validation and CRUD regression tests passed.",
        name: "Validate team-derived fixture bootstrapping",
        openedAt: "2026-02-26T17:25:00.000Z",
        priority: SEEDED_PRIORITY_LOW,
        progressPercentage: 100,
        status: SEEDED_ISSUE_STATUS_CLOSED,
      }),
    ],
  },
  organizations: {
    orgOrganizationManager: {
      description: "Seeded org for organization-manager fixture coverage.",
      name: "Seed Fixture Organization Manager Org",
    },
    orgProjectManager: {
      description: "Seeded org for organization-project-manager fixture coverage.",
      name: "Seed Fixture Organization Project Manager Org",
    },
    orgTeamManager: {
      description: "Seeded org for organization-team-manager fixture coverage.",
      name: "Seed Fixture Organization Team Manager Org",
    },
  },
  projects: {
    orgProjectManager: {
      description: "Seeded project managed through organization-scoped project authority.",
      name: "Seed Fixture Organization Project Managed Project",
    },
    projectProjectManager: {
      description: "Seeded project managed through direct project-scoped authority.",
      name: "Seed Fixture Direct Project Managed Project",
    },
    teamProjectManager: {
      description: "Seeded project managed through team-scoped project authority.",
      name: "Seed Fixture Team Project Managed Project",
    },
  },
  teams: {
    orgTeamManager: {
      description: "Seeded team managed through organization-scoped team authority.",
      name: "Seed Fixture Organization Team Managed Team",
    },
    teamProjectManager: {
      description: "Seeded team carrying team-scoped project-manager authority.",
      name: "Seed Fixture Team Project Managed Team",
    },
    teamTeamManager: {
      description: "Seeded team managed through direct team-scoped authority.",
      name: "Seed Fixture Direct Team Managed Team",
    },
  },
} as const;
