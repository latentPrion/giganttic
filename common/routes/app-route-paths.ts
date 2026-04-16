/**
 * Route path constants for `react-router` `<Route path>` and in-app `navigate` / `<Link to>`.
 *
 * These constants are deployment-base-path agnostic and intentionally do not include `/pm`.
 * The deploy prefix is controlled by `VITE_APP_BASE_PATH` via `frontendConfig.appBasePath` and
 * `BrowserRouter.basename` in `frontend/src/main.tsx`.
 */

const ROOT_ROUTE_PATH = "/";
const AUTH_ROUTE_ROOT = "/auth";
/**
 * PM module root path within the SPA (before deploy basename is applied).
 * With `VITE_APP_BASE_PATH=/pm`, this renders externally as `/pm/project`.
 */
export const PROJECT_MANAGER_ROUTE_ROOT = "/project";
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
