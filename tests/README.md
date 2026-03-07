Root-level tests live here when they are not tied to a specific database schema version.

Guidelines:

- Put schema-version-specific tests under the matching schema folder, for example `db/v1/tests/`.
- Put cross-version helpers, generic contract tests, shared utility tests, and future app-level tests in `tests/`.
