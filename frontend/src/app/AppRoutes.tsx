import React from "react";
import {
  Route,
  Routes,
} from "react-router-dom";

import { AboutPage } from "../home/components/AboutPage.js";
import { ContactPage } from "../home/components/ContactPage.js";
import { HomeHero } from "../home/components/HomeHero.js";
import { GanttRoute } from "../spas/project-manager/routes/GanttRoute.js";
import { IssueRoute } from "../spas/project-manager/routes/IssueRoute.js";
import { IssuesRoute } from "../spas/project-manager/routes/IssuesRoute.js";
import { KanbanRoute } from "../spas/project-manager/routes/KanbanRoute.js";
import { ProjectRoute } from "../spas/project-manager/routes/ProjectRoute.js";
import { PublicHomeLayout } from "../spas/public-home/layouts/PublicHomeLayout.js";
import { LobbyRoute } from "../spas/user-lobby/routes/LobbyRoute.js";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicHomeLayout />}>
        <Route element={<HomeHero />} index />
        <Route element={<ContactPage />} path="/contact" />
        <Route element={<AboutPage />} path="/about" />
      </Route>
      <Route element={<LobbyRoute />} path="/lobby" />
      <Route element={<ProjectRoute />} path="/pm/project" />
      <Route element={<GanttRoute />} path="/pm/project/gantt" />
      <Route element={<KanbanRoute />} path="/pm/project/kanban" />
      <Route element={<IssuesRoute />} path="/pm/project/issues" />
      <Route element={<IssueRoute />} path="/pm/project/issue" />
    </Routes>
  );
}
