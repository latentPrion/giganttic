/**
 * Route path constants for `react-router` `<Route path>` and in-app `navigate` / `<Link to>`.
 *
 * These constants describe the app's own route namespace. They intentionally do not include the
 * reverse-proxy mount path; that external deployment prefix is controlled by
 * `VITE_PROXY_PASS_MOUNT_PATH` via `frontendConfig.proxyPassMountPath` and
 * `BrowserRouter.basename` in `frontend/src/main.tsx`. If the proxy mount path and an app route
 * segment are both `/pm`, the external URL is expected to contain both segments, e.g. `/pm/pm/project`.
 */

const ROOT_ROUTE_PATH = "/";
const AUTH_ROUTE_ROOT = "/auth";
const PROJECT_MANAGER_ROUTE_NAMESPACE = "/pm";
/**
 * PM module root path within the SPA (before the proxy-pass mount path is applied).
 * With `VITE_PROXY_PASS_MOUNT_PATH=/pm`, this renders externally as `/pm/pm/project`.
 */
export const PROJECT_MANAGER_ROUTE_ROOT = `${PROJECT_MANAGER_ROUTE_NAMESPACE}/project`;
const USER_ROUTE_ROOT = "/user";

export const HOME_ROUTE_PATH = ROOT_ROUTE_PATH;
export const CONTACT_ROUTE_PATH = "/contact";
export const ABOUT_ROUTE_PATH = "/about";
export const SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH = `${AUTH_ROUTE_ROOT}/scoped-token-login`;

export const USER_ROUTE_PATH = USER_ROUTE_ROOT;
export const USER_LOBBY_ROUTE_PATH = `${USER_ROUTE_ROOT}/lobby`;

export const PROJECT_MANAGER_ROUTE_PATH = PROJECT_MANAGER_ROUTE_ROOT;
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
