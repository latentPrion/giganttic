import React from "react";
import {
  Box,
  Tab,
  Tabs,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  createProjectDetailRoute,
  createProjectGanttRoute,
  createProjectKanbanRoute,
  createProjectIssuesRoute,
  createProjectTasksRoute,
  type ProjectRouteSection,
} from "../routes/project-route-paths.js";

interface ProjectManagerProjectNavigationProps {
  actions?: React.ReactNode;
  currentSection: ProjectRouteSection;
  projectId: number | null;
}

const DETAIL_LABEL = "Details";
const GANTT_LABEL = "Gantt";
const KANBAN_LABEL = "Kanban Board";
const ISSUES_LABEL = "Issues";
const TASKS_LABEL = "Tasks";

function buildRouteForSection(
  currentSection: ProjectRouteSection,
  projectId: number | null,
): string {
  if (projectId === null) {
    return "";
  }

  switch (currentSection) {
    case "detail":
      return createProjectDetailRoute(projectId);
    case "gantt":
      return createProjectGanttRoute(projectId);
    case "kanban":
      return createProjectKanbanRoute(projectId);
    case "issues":
      return createProjectIssuesRoute(projectId);
    case "tasks":
      return createProjectTasksRoute(projectId);
  }
}

export function ProjectManagerProjectNavigation(
  props: ProjectManagerProjectNavigationProps,
) {
  const navigate = useNavigate();

  function handleSectionChange(
    _event: React.SyntheticEvent,
    nextSection: ProjectRouteSection,
  ): void {
    if (props.projectId === null) {
      return;
    }

    navigate(buildRouteForSection(nextSection, props.projectId));
  }

  return (
    <Box
      sx={{
        alignItems: { xs: "stretch", md: "center" },
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 1.5,
        justifyContent: "space-between",
      }}
    >
      <Tabs
        onChange={handleSectionChange}
        sx={{ flex: 1, minWidth: 0 }}
        value={props.currentSection}
        variant="scrollable"
      >
        <Tab disabled={props.projectId === null} label={DETAIL_LABEL} value="detail" />
        <Tab disabled={props.projectId === null} label={GANTT_LABEL} value="gantt" />
        <Tab disabled={props.projectId === null} label={KANBAN_LABEL} value="kanban" />
        <Tab disabled={props.projectId === null} label={ISSUES_LABEL} value="issues" />
        <Tab disabled={props.projectId === null} label={TASKS_LABEL} value="tasks" />
      </Tabs>
      {props.actions ? (
        <Box sx={{ flexShrink: 0, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
          {props.actions}
        </Box>
      ) : null}
    </Box>
  );
}
