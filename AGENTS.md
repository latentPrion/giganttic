# Project Instructions

- Always break functions into logical subfunctions. No long-scrolling functions, in any language. This applies to source code, scripts, build scripts, CMake, Makefiles, and similar project files. Preserve this subfunction splitting discipline during refactors.
- Modularity is non-negotiable. Always group logically related functions together into a module. Preserve modularity during refactors.
- Always isolate configurable behaviour into configuration variables appropriate for the language and framework being used.
- Never bake in literals; at minimum, declare them at the top of the file with a semantically meaningful name.
- UI should be responsive. Always prefer to use pre-packaged UI toolkit widgets, containers and colour sets harmoniously, instead of writing custom CSS overrides. Write custom CSS only if there's no UI toolkit mechanism available.

