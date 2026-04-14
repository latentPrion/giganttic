import React from "react";
import {
  ABOUT_ROUTE_PATH,
  CONTACT_ROUTE_PATH,
  LEGACY_PROJECT_ROUTE_PATTERN,
  PROJECT_MANAGER_GANTT_ROUTE_PATH,
  PROJECT_MANAGER_ISSUES_ROUTE_PATH,
  PROJECT_MANAGER_ISSUE_ROUTE_PATH,
  PROJECT_MANAGER_KANBAN_ROUTE_PATH,
  PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH,
  PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH,
  PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
  PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
  PROJECT_MANAGER_ROUTE_ROOT,
  PROJECT_MANAGER_ROUTE_PATH,
  PROJECT_MANAGER_TASKS_ROUTE_PATH,
  PROJECT_MANAGER_TASK_ROUTE_PATH,
  PROJECT_MANAGER_TEAM_ROUTE_PATH,
  SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH,
  USER_ROUTE_PATH,
} from "../../../common/routes/app-route-paths.js";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";

import { AboutPage } from "../home/components/AboutPage.js";
import { ContactPage } from "../home/components/ContactPage.js";
import { HomeHero } from "../home/components/HomeHero.js";
import { ScopedAccessTokenLoginRoute } from "../common/session/routes/ScopedAccessTokenLoginRoute.js";
import { GanttRoute } from "../spas/project-manager/routes/GanttRoute.js";
import { IssueRoute } from "../spas/project-manager/routes/IssueRoute.js";
import { IssuesRoute } from "../spas/project-manager/routes/IssuesRoute.js";
import { KanbanRoute } from "../spas/project-manager/routes/KanbanRoute.js";
import { MgrUploadsRoute } from "../spas/project-manager/routes/MgrUploadsRoute.js";
import { NotificationsRoute } from "../spas/project-manager/routes/NotificationsRoute.js";
import { OrganizationRoute } from "../spas/project-manager/routes/OrganizationRoute.js";
import { ProjectRoute } from "../spas/project-manager/routes/ProjectRoute.js";
import { TaskRoute } from "../spas/project-manager/routes/TaskRoute.js";
import { TasksRoute } from "../spas/project-manager/routes/TasksRoute.js";
import { TeamRoute } from "../spas/project-manager/routes/TeamRoute.js";
import { PublicHomeLayout } from "../spas/public-home/layouts/PublicHomeLayout.js";
import { UserSpaRoute } from "../spas/user/routes/UserSpaRoute.js";

function MgrUploadsTypoRedirect() {
  const location = useLocation();
  return (
    <Navigate
      replace
      to={`${PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH}${location.search}`}
    />
  );
}

function LegacyProjectRouteRedirect() {
  const params = useParams<{ projectId?: string }>();
  const rawProjectId = params.projectId?.trim() ?? "";
  const parsedProjectId = Number(rawProjectId);
  const targetPath = Number.isInteger(parsedProjectId) && parsedProjectId > 0
    ? `${PROJECT_MANAGER_ROUTE_PATH}?projectId=${parsedProjectId}`
    : PROJECT_MANAGER_ROUTE_PATH;

  return <Navigate replace to={targetPath} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicHomeLayout />}>
        <Route element={<HomeHero />} index />
        <Route element={<ContactPage />} path={CONTACT_ROUTE_PATH} />
        <Route element={<AboutPage />} path={ABOUT_ROUTE_PATH} />
      </Route>
      <Route element={<ScopedAccessTokenLoginRoute />} path={SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH} />
      <Route element={<LegacyProjectRouteRedirect />} path={LEGACY_PROJECT_ROUTE_PATTERN} />
      <Route element={<Navigate replace to={PROJECT_MANAGER_ROUTE_PATH} />} path={PROJECT_MANAGER_ROUTE_ROOT} />
      <Route element={<ProjectRoute />} path={PROJECT_MANAGER_ROUTE_PATH} />
      <Route element={<TeamRoute />} path={PROJECT_MANAGER_TEAM_ROUTE_PATH} />
      <Route element={<OrganizationRoute />} path={PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH} />
      <Route element={<UserSpaRoute />} path={`${USER_ROUTE_PATH}/*`} />
      <Route element={<GanttRoute />} path={PROJECT_MANAGER_GANTT_ROUTE_PATH} />
      <Route element={<KanbanRoute />} path={PROJECT_MANAGER_KANBAN_ROUTE_PATH} />
      <Route element={<MgrUploadsTypoRedirect />} path={PROJECT_MANAGER_MGR_UPLOAD_TYPO_ROUTE_PATH} />
      <Route element={<MgrUploadsRoute />} path={PROJECT_MANAGER_MGR_UPLOADS_ROUTE_PATH} />
      <Route element={<NotificationsRoute />} path={PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH} />
      <Route element={<IssuesRoute />} path={PROJECT_MANAGER_ISSUES_ROUTE_PATH} />
      <Route element={<TasksRoute />} path={PROJECT_MANAGER_TASKS_ROUTE_PATH} />
      <Route element={<IssueRoute />} path={PROJECT_MANAGER_ISSUE_ROUTE_PATH} />
      <Route element={<TaskRoute />} path={PROJECT_MANAGER_TASK_ROUTE_PATH} />
    </Routes>
  );
}
