Ok. I've deleted all the files except docs/ and charts/. We're going to go with temporal. Backend files go into /backend/. Frontend files go into /frontend/. All code written in typescript with strict type checking.
Add a git submodule to clone gantt.git (that path should work since it's just a forked project under my git username, but lemme know if it doesn't work) in the subdir /dhtmlx-gantt/.
We'll focus first on getting the user accounts to work.
I need an sqlite DB.
Db schema is written out in typescript in /db/.
Different versions of the DB schema each go into a subdir of /db/. Each version has its own generated ZOD schema files.
Migrations live under /db/migrations. Each migrations subdir contains the files needed to migrate from one schema subdir to another, named as db/<from-schame>--<to-schema>/.

```
/db/ # Example layout for this folder.
* test-schema-v1/
  * schema.ts
  * generated-zod/
    * <ZOD schema enforcement files here>.
  * generated-sql-ddl/
    * <Generated SQL DDL .sql files for this schema>
* test-schema-v2/
  * schema.ts
  * generated-zod/
    * <ZOD schema enforcement files here>.
  * generated-sql-ddl/
    * <Generated SQL DDL .sql files for this schema>
* v1/
  * schema.ts
  * generated-zod/
    * <ZOD schema enforcement files here>.
  * generated-sql-ddl/
    * <Generated SQL DDL .sql files for this schema>
* v2/
  * schema.ts
  * generated-zod/
    * <ZOD schema enforcement files here>.
  * generated-sql-ddl/
    * <Generated SQL DDL .sql files for this schema>
* v3/
  * schema.ts
  * generated-zod/
    * <ZOD schema enforcement files here>.
  * generated-sql-ddl/
    * <Generated SQL DDL .sql files for this schema>
* migrations/
  * test-schema-v1--test-schema-v2/
    * <Migrations .sql and other files in here>
  * v1--v2/
    * <Migrations .sql and other files in here>
  * v2--v3/
    * <Migrations .sql and other files in here>

```

## The schema

1:N and N:N tables combine the names of their foreign keys as <table1>_<table2>.
Table names are in UpperCamelCase with no underscores for a primary table name. Table field names are in lowerCamelCase. Underscores are only used to separate primary table names in a 1:N/N:N table name.

Each User may optionally have N Roles. Each User may have N roles associated. So you'll need a Users_Roles 1:N table to track Users and Roles. Each User may also have N login CredentialTypes for auth. Credential types include username+password (GGTT_CREDTYPE_USERNAME_PASSWORD) for now only; but we may later add credentials like passkey, SSO oauth, etc. So you'll need a Users_CredentialTypes table; this table will be 1:N where 1 User can have N CredentialTypes -- but only 1 of each CredentialType -- so 1 user+pass, 1 passkey, 1 sso auth, etc. Then you'll need a table for actual credentials. So Users_PasswordCredentials table which maps User IDs to passwords.

Then we have the User Roles. I need a Users_Roles table which maps 1:N. Roles include, for now: GGTT_ROLE_PROJECT_MANAGER ("Project Manager") (GGTT is the name of the project: Gigantt), GGTT_ROLE_ADMIN ("Administrator").

Then we have sessions tracking. Users_Sessions table. Each session has a startTimestamp, expirationTimestamp, location, and oauth codes for that session. The plan (not for now, but later) is to allow users to create Sessions and hand out oauth tokens for a session, which can be revoked by deleting the session, or otherwise when the session expires, the oauth will also be revoked. Not for now tho.

All DB operations should properly use Drizzle ORM operations. All JSON REST operations should properly enforce type-safety using Zod at the REST boundary.
