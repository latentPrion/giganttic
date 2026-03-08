Root-level tests live here when they are not tied to a specific database schema version.

Guidelines:

- Put schema-version-specific tests under the matching schema folder, for example `db/v1/tests/`.
- Put cross-version helpers, generic contract tests, shared utility tests, and future app-level tests in `tests/`.

Local auth test fixtures:

- `testadminuser` / `testadminuser@giganttic.com`
- `testnoroleuser` / `testnoroleuser@giganttic.com`
- plaintext password for both seeded local accounts: `1234`

Seeded Argon2id hashes used by backend bootstrap:

- `testadminuser`: `$argon2id$v=19$m=65536,t=3,p=4$dGVzdGFkbWludXNlci1zZWVk$P9p0LD9Hk170tBlwVh+aHKH628YCc97Ay7wSKYog0mU`
- `testnoroleuser`: `$argon2id$v=19$m=65536,t=3,p=4$dGVzdG5vcm9sZXVzZXItc2VlZA$vpckBrphmwLImn/Yb8EsXSg/YEGtd7rsTEaXl7UIYGE`
