# Project Instructions

- Always break functions into logical subfunctions. No long-scrolling functions, in any language. This applies to source code, scripts, build scripts, CMake, Makefiles, and similar project files. Preserve this subfunction splitting discipline during refactors.
- Modularity is non-negotiable. Always group logically related functions together into a module. Preserve modularity during refactors.
- Reuse or extend existing abstractions instead of duplicating logic wherever possible. Don't repeat yourself. The goal here is to prevent duplication. Not to discourage appropriate logical separation of prior abstractions into new logical abstractions where sensible.
- Always isolate configurable behaviour into configuration variables appropriate for the language and framework being used.
- Never bake in literals; at minimum, declare them at the top of the file with a semantically meaningful name.
- UI should be responsive. Always prefer to use pre-packaged UI toolkit widgets, containers and colour sets harmoniously, instead of writing custom CSS overrides. Write custom CSS only if there's no UI toolkit mechanism available.
- When altering the DB schema, never delete fields. Instead rename the field to reusable-<schema-name-where-field-was-deleted>. This way we can migrate portably on DBMSs that don't easily support field deletion.
- When altering the DB schema to add a new field, check first whether a pre-existing reusable-<schema-name-where-field-was-deleted> field exists whose type matches the intended new field. If so, then reuse the reusable-<schema-name-where-field-was-deleted> field by renaming it appropriately for the new field name and generate update statements in [`pre`/`post`]`-structural-data-migration.sql` files for all current rowdata which initialize them with an appropriate value (which would be null). These update statements should be placed into the migrations/ subdir.
