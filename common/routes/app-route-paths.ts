/**
 * Route path constants for `react-router` `<Route path>` and in-app `navigate` / `<Link to>`.
 *
 * **Two `/pm` segments (canonical PM URLs)**
 * - **`VITE_APP_BASE_PATH` / nginx** — first segment: the reverse-proxy mount (`/pm/`), static assets, and
 *   any path that `buildAppRelativeUrl` prefixes when `appBasePath` is `/pm`.
 * - **Project management module** — second segment: PM routes are **`/pm/pm/...`** (deploy prefix + PM
 *   module root). This intentionally produces **`/pm/pm/...`** in the browser; it is the supported shape.
 * - **`BrowserRouter` uses `basename="/"`** in `main.tsx` so matchers see the full pathname (e.g.
 *   `/pm/pm/project`). Do not set `basename` to `/pm` unless you also change these constants and tests.
 *
 * **`buildAppRelativeUrl`** (`frontend/src/common/routing/public-app-url.ts`)
 * - Idempotent: if the path already starts with `appBasePath` (e.g. `/pm`), it is returned unchanged.
 *   Pass paths *relative* to the deploy prefix for prefixing (e.g. `/contact` → `/pm/contact`). PM route
 *   constants are full paths; do not run them through `buildAppRelativeUrl` to add another `/pm`.
 */

const ROOT_ROUTE_PATH = "/";
const AUTH_ROUTE_ROOT = "/auth";
/**
 * PM module root pathname (second `/pm` under the `/pm` deploy prefix → `/pm/pm/...`).
 * Prefer `PROJECT_MANAGER_*_ROUTE_PATH` instead of concatenating this value manually.
 */
export const PROJECT_MANAGER_ROUTE_ROOT = "/pm/pm";
/**
 * Nginx + Vite public mount (`location ^~ /pm/`). Not the PM module root (`PROJECT_MANAGER_ROUTE_ROOT`).
 * `/pm` and `/pm/` must map into PM routes; in `AppRoutes`, add a second `<Route>` whose `path` is
 * `` `${DEPLOYMENT_SPA_MOUNT_PATH}/` `` (template literal) so `/pm/` matches.
 */
export const DEPLOYMENT_SPA_MOUNT_PATH = "/pm";
const USER_ROUTE_ROOT = "/user";

export const HOME_ROUTE_PATH = ROOT_ROUTE_PATH;
export const CONTACT_ROUTE_PATH = "/contact";
export const ABOUT_ROUTE_PATH = "/about";
export const SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}${AUTH_ROUTE_ROOT}/scoped-token-login`;

export const USER_ROUTE_PATH = USER_ROUTE_ROOT;
export const USER_LOBBY_ROUTE_PATH = `${USER_ROUTE_ROOT}/lobby`;

export const PROJECT_MANAGER_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}/project`;
export const PROJECT_MANAGER_TEAM_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}/team`;
export const PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}/organization`;
export const PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}/notifications`;
export const PROJECT_MANAGER_GANTT_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_PATH}/gantt`;
export const PROJECT_MANAGER_KANBAN_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_PATH}/kanban`;
export const PROJECT_MANAGER_ISSUES_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_PATH}/issues`;
export const PROJECT_MANAGER_TASKS_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_PATH}/tasks`;
export const PROJECT_MANAGER_ISSUE_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_PATH}/issue`;
export const PROJECT_MANAGER_TASK_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_PATH}/task`;
export const PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}/mgr-uploads`;
