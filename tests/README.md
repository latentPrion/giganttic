Root-level tests live here when they are not tied to a specific database schema version.

Guidelines:

- Put schema-version-specific tests under the matching schema folder, for example `db/v1/tests/`.
- Put cross-version helpers, generic contract tests, shared utility tests, and future app-level tests in `tests/`.

Local auth test fixtures:

- `testadminuser` / `testadminuser@giganttic.com`
- `testnoroleuser` / `testnoroleuser@giganttic.com`
- `testorgorgmanageruser` / `testorgorgmanageruser@giganttic.com`
- `testorgprojectmanageruser` / `testorgprojectmanageruser@giganttic.com`
- `testorgteammanageruser` / `testorgteammanageruser@giganttic.com`
- `testprojectprojectmanageruser` / `testprojectprojectmanageruser@giganttic.com`
- `testteamprojectmanageruser` / `testteamprojectmanageruser@giganttic.com`
- `testteamteammanageruser` / `testteamteammanageruser@giganttic.com`
- plaintext password for all seeded local accounts: `1234`

Seeded Argon2id hashes used by backend bootstrap:

- `testadminuser`: `$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU`
- `testnoroleuser`: `$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE`
- shared hash for the additional seeded scoped-role accounts:
  `$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE`

Seeded scoped-role fixtures:

- `testorgorgmanageruser`: direct org membership plus
  `GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER`
- `testorgprojectmanageruser`: direct org membership plus
  `GGTC_ORGANIZATIONROLE_PROJECT_MANAGER`, with a directly associated seeded
  project
- `testorgteammanageruser`: direct org membership plus
  `GGTC_ORGANIZATIONROLE_TEAM_MANAGER`, with an org-owned seeded team
- `testprojectprojectmanageruser`: direct seeded project membership plus
  `GGTC_PROJECTROLE_PROJECT_MANAGER`
- `testteamprojectmanageruser`: seeded team membership plus
  `GGTC_TEAMROLE_PROJECT_MANAGER`, with that team linked to a seeded project
- `testteamteammanageruser`: seeded team membership plus
  `GGTC_TEAMROLE_TEAM_MANAGER`
