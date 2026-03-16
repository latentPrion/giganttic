const SEEDED_EMAIL_DOMAIN = "giganttic.com";
const SEEDED_PLAINTEXT_PASSWORD = "1234";
const SEEDED_CLOSED_REASON_RESOLVED = "ISSUE_CLOSED_REASON_RESOLVED";
const SEEDED_ISSUE_STATUS_BLOCKED = "ISSUE_STATUS_BLOCKED";
const SEEDED_ISSUE_STATUS_CLOSED = "ISSUE_STATUS_CLOSED";
const SEEDED_ISSUE_STATUS_IN_PROGRESS = "ISSUE_STATUS_IN_PROGRESS";
const SEEDED_ISSUE_STATUS_OPEN = "ISSUE_STATUS_OPEN";
const SEEDED_PRIORITY_LOW = 1;
const SEEDED_PRIORITY_MEDIUM = 3;
const SEEDED_PRIORITY_HIGH = 5;
const SEEDED_CHART_DURATION_DAYS = 3;
const SEEDED_CHART_PROGRESS = "0.35";
const SEEDED_CHART_REVIEW_DURATION_DAYS = 2;
const SEEDED_CHART_REVIEW_PROGRESS = "0.1";
const ADMIN_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU";
const SHARED_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE";

type SeededAccount = {
  email: string;
  passwordHash: string;
  plaintextPassword: string;
  seedKey: string;
  username: string;
};

type SeededIssue = {
  closedAt: string | null;
  closedReason: string | null;
  closedReasonDescription: string | null;
  description: string | null;
  journal: string | null;
  name: string;
  openedAt: string;
  priority: number;
  progressPercentage: number;
  status: string;
};

type SeededNamedEntity = {
  description: string;
  name: string;
  seedKey: string;
};

type SeededChart = string;

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
}): SeededIssue {
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

function createSeededAccount(seedKey: string, username: string): SeededAccount {
  return {
    email: `${username}@${SEEDED_EMAIL_DOMAIN}`,
    passwordHash: SHARED_PASSWORD_HASH,
    plaintextPassword: SEEDED_PLAINTEXT_PASSWORD,
    seedKey,
    username,
  };
}

function createSeededNamedEntity(
  seedKey: string,
  name: string,
  description: string,
): SeededNamedEntity {
  return {
    description,
    name,
    seedKey,
  };
}

function createSeededChart(seed: {
  linkId: number;
  reviewTaskId: number;
  reviewTaskStartDate: string;
  reviewTaskText: string;
  rootTaskId: number;
  rootTaskStartDate: string;
  rootTaskText: string;
}): SeededChart {
  return `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="${seed.rootTaskId}" open="1" parent="0" progress="${SEEDED_CHART_PROGRESS}" start_date="${seed.rootTaskStartDate}" duration="${SEEDED_CHART_DURATION_DAYS}"><![CDATA[${seed.rootTaskText}]]></task>
  <task id="${seed.reviewTaskId}" open="1" parent="${seed.rootTaskId}" progress="${SEEDED_CHART_REVIEW_PROGRESS}" start_date="${seed.reviewTaskStartDate}" duration="${SEEDED_CHART_REVIEW_DURATION_DAYS}"><![CDATA[${seed.reviewTaskText}]]></task>
  <coll_options for="links">
    <item id="${seed.linkId}" source="${seed.rootTaskId}" target="${seed.reviewTaskId}" type="0" />
  </coll_options>
</data>
`;
}

const seededTestAccounts = {
  admin: {
    email: "testadminuser@giganttic.com",
    passwordHash: ADMIN_PASSWORD_HASH,
    plaintextPassword: SEEDED_PLAINTEXT_PASSWORD,
    seedKey: "user:admin",
    username: "testadminuser",
  },
  noRole: createSeededAccount("user:noRole", "testnoroleuser"),
  orgOrganizationManager: createSeededAccount(
    "user:orgOrganizationManager",
    "testorgorgmanageruser",
  ),
  orgProjectManager: createSeededAccount(
    "user:orgProjectManager",
    "testorgprojectmanageruser",
  ),
  orgTeamManager: createSeededAccount(
    "user:orgTeamManager",
    "testorgteammanageruser",
  ),
  projectProjectManager: createSeededAccount(
    "user:projectProjectManager",
    "testprojectprojectmanageruser",
  ),
  teamProjectManager: createSeededAccount(
    "user:teamProjectManager",
    "testteamprojectmanageruser",
  ),
  teamTeamManager: createSeededAccount(
    "user:teamTeamManager",
    "testteamteammanageruser",
  ),
} as const;

const seededScopedFixtures = {
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
      createSeededIssue({
        description: "Document sample organization PM issue priority ordering for downstream UI work.",
        journal: "Keeps the org project fixture useful for backlog sorting demos.",
        name: "Document org PM backlog ordering",
        openedAt: "2026-03-05T09:25:00.000Z",
        priority: SEEDED_PRIORITY_MEDIUM,
        progressPercentage: 60,
        status: SEEDED_ISSUE_STATUS_IN_PROGRESS,
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
      createSeededIssue({
        description: "Track a second open sample so direct-PM projects have a richer seeded backlog.",
        journal: "Useful for seeded list ordering and detail-page regression tests.",
        name: "Expand direct PM seeded backlog",
        openedAt: "2026-03-06T10:05:00.000Z",
        priority: SEEDED_PRIORITY_HIGH,
        progressPercentage: 25,
        status: SEEDED_ISSUE_STATUS_IN_PROGRESS,
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
      createSeededIssue({
        description: "Keep an extra routed-work sample on the team-derived project fixture.",
        journal: "Supports seeded demos for issue prioritization and PM issue routing.",
        name: "Seed team-derived routed work sample",
        openedAt: "2026-03-05T14:10:00.000Z",
        priority: SEEDED_PRIORITY_MEDIUM,
        progressPercentage: 45,
        status: SEEDED_ISSUE_STATUS_IN_PROGRESS,
      }),
    ],
  },
  organizations: {
    orgOrganizationManager: createSeededNamedEntity(
      "organization:orgOrganizationManager",
      "Seed Fixture Organization Manager Org",
      "Seeded org for organization-manager fixture coverage.",
    ),
    orgProjectManager: createSeededNamedEntity(
      "organization:orgProjectManager",
      "Seed Fixture Organization Project Manager Org",
      "Seeded org for organization-project-manager fixture coverage.",
    ),
    orgTeamManager: createSeededNamedEntity(
      "organization:orgTeamManager",
      "Seed Fixture Organization Team Manager Org",
      "Seeded org for organization-team-manager fixture coverage.",
    ),
  },
  projects: {
    charts: {
      orgProjectManager: createSeededChart({
        linkId: 2101,
        reviewTaskId: 202,
        reviewTaskStartDate: "2026-03-03 11:00",
        reviewTaskText: "Org-scoped access audit",
        rootTaskId: 201,
        rootTaskStartDate: "2026-03-02 10:00",
        rootTaskText: "Org project planning",
      }),
      projectProjectManager: createSeededChart({
        linkId: 1101,
        reviewTaskId: 102,
        reviewTaskStartDate: "2026-03-04 09:00",
        reviewTaskText: "Issue workflow polish",
        rootTaskId: 101,
        rootTaskStartDate: "2026-03-03 09:00",
        rootTaskText: "Direct PM kickoff",
      }),
      teamProjectManager: createSeededChart({
        linkId: 3101,
        reviewTaskId: 302,
        reviewTaskStartDate: "2026-03-02 09:00",
        reviewTaskText: "Team permissions verification",
        rootTaskId: 301,
        rootTaskStartDate: "2026-03-01 08:30",
        rootTaskText: "Team-linked PM rollout",
      }),
    },
    orgProjectManager: createSeededNamedEntity(
      "project:orgProjectManager",
      "Seed Fixture Organization Project Managed Project",
      "Seeded project managed through organization-scoped project authority.",
    ),
    projectProjectManager: createSeededNamedEntity(
      "project:projectProjectManager",
      "Seed Fixture Direct Project Managed Project",
      "Seeded project managed through direct project-scoped authority.",
    ),
    teamProjectManager: createSeededNamedEntity(
      "project:teamProjectManager",
      "Seed Fixture Team Project Managed Project",
      "Seeded project managed through team-scoped project authority.",
    ),
  },
  teams: {
    orgTeamManager: createSeededNamedEntity(
      "team:orgTeamManager",
      "Seed Fixture Organization Team Managed Team",
      "Seeded team managed through organization-scoped team authority.",
    ),
    teamProjectManager: createSeededNamedEntity(
      "team:teamProjectManager",
      "Seed Fixture Team Project Managed Team",
      "Seeded team carrying team-scoped project-manager authority.",
    ),
    teamTeamManager: createSeededNamedEntity(
      "team:teamTeamManager",
      "Seed Fixture Direct Team Managed Team",
      "Seeded team managed through direct team-scoped authority.",
    ),
  },
} as const;

export {
  seededScopedFixtures,
  seededTestAccounts,
};
