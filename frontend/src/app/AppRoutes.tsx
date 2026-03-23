import React from "react";
import {
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { AboutPage } from "../home/components/AboutPage.js";
import { ContactPage } from "../home/components/ContactPage.js";
import { HomeHero } from "../home/components/HomeHero.js";
import { GanttRoute } from "../spas/project-manager/routes/GanttRoute.js";
import { IssueRoute } from "../spas/project-manager/routes/IssueRoute.js";
import { IssuesRoute } from "../spas/project-manager/routes/IssuesRoute.js";
import { KanbanRoute } from "../spas/project-manager/routes/KanbanRoute.js";
import { OrganizationRoute } from "../spas/project-manager/routes/OrganizationRoute.js";
import { ProjectRoute } from "../spas/project-manager/routes/ProjectRoute.js";
import { TasksRoute } from "../spas/project-manager/routes/TasksRoute.js";
import { TeamRoute } from "../spas/project-manager/routes/TeamRoute.js";
import { UserRoute } from "../spas/project-manager/routes/UserRoute.js";
import { PublicHomeLayout } from "../spas/public-home/layouts/PublicHomeLayout.js";
import { LobbyRoute } from "../spas/user-lobby/routes/LobbyRoute.js";

function LegacyProjectRouteRedirect() {
  const params = useParams<{ projectId?: string }>();
  const rawProjectId = params.projectId?.trim() ?? "";
  const parsedProjectId = Number(rawProjectId);
  const targetPath = Number.isInteger(parsedProjectId) && parsedProjectId > 0
    ? `/pm/project?projectId=${parsedProjectId}`
    : "/pm/project";

  return <Navigate replace to={targetPath} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicHomeLayout />}>
        <Route element={<HomeHero />} index />
        <Route element={<ContactPage />} path="/contact" />
        <Route element={<AboutPage />} path="/about" />
      </Route>
      <Route element={<LobbyRoute />} path="/lobby" />
      <Route element={<LegacyProjectRouteRedirect />} path="/project/:projectId" />
      <Route element={<ProjectRoute />} path="/pm/project" />
      <Route element={<TeamRoute />} path="/pm/team" />
      <Route element={<OrganizationRoute />} path="/pm/organization" />
      <Route element={<UserRoute />} path="/pm/user" />
      <Route element={<GanttRoute />} path="/pm/project/gantt" />
      <Route element={<KanbanRoute />} path="/pm/project/kanban" />
      <Route element={<IssuesRoute />} path="/pm/project/issues" />
      <Route element={<TasksRoute />} path="/pm/project/tasks" />
      <Route element={<IssueRoute />} path="/pm/project/issue" />
    </Routes>
  );
}
