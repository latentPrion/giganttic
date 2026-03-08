const SEEDED_EMAIL_DOMAIN = "giganttic.com";
const SEEDED_PLAINTEXT_PASSWORD = "1234";
const ADMIN_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU";
const SHARED_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE";

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
