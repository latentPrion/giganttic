/**
 * Route path constants for `react-router` `<Route path>` and in-app `navigate` / `<Link to>`.
 *
 * **Browser router basename (`main.tsx`)**
 * - PM paths here are **full site pathnames** (e.g. `/pm/project`). The app uses `BrowserRouter`
 *   `basename="/"` so the matcher sees that full pathname. If you set `basename` to the deploy
 *   prefix (e.g. `/pm`), paths would be stripped and would **not** match these `/pm/...` patterns.
 *
 * **`VITE_APP_BASE_PATH` / `buildAppRelativeUrl` (see `frontend/src/common/routing/public-app-url.ts`)**
 * - That env drives Vite `base` and **non-router** URLs (assets, scoped-login links, emails). It is
 *   not the React Router basename. Do not pass PM route strings through `buildAppRelativeUrl` unless
 *   you intend to prepend `appBasePath` again.
 *
 * **Reverse proxy / hosting**
 * - The browser’s `location.pathname` for PM screens must be `/pm/...` as defined here. If nginx
 *   (or similar) mounts the SPA under an extra prefix, either rewrite the URL before the SPA or
 *   change these constants and the server config together; env alone cannot retarget them.
 *
 * **`PROJECT_MANAGER_ROUTE_ROOT`**
 * - Prefer the exported `PROJECT_MANAGER_*_ROUTE_PATH` constants for links and routes. Avoid
 *   hand-building path strings from this segment so paths stay consistent.
 */

const ROOT_ROUTE_PATH = "/";
const AUTH_ROUTE_ROOT = "/auth";
/**
 * First path segment for PM SPA URLs. Prefer `PROJECT_MANAGER_*_ROUTE_PATH` instead of concatenating
 * this value manually.
 */
export const PROJECT_MANAGER_ROUTE_ROOT = "/pm";
const USER_ROUTE_ROOT = "/user";

export const HOME_ROUTE_PATH = ROOT_ROUTE_PATH;
export const CONTACT_ROUTE_PATH = "/contact";
export const ABOUT_ROUTE_PATH = "/about";
export const SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}${AUTH_ROUTE_ROOT}/scoped-token-login`;
export const LEGACY_PROJECT_ROUTE_PATTERN = "/project/:projectId";

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

/** Common typo for `PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH` (`mgr-upload` vs `mgr-uploads`). */
export const PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH = `${PROJECT_MANAGER_ROUTE_ROOT}/mgr-upload`;
