import React from "react";
import {
  Tab,
  Tabs,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  createProjectDetailRoute,
  createProjectGanttRoute,
  createProjectIssuesRoute,
  type ProjectRouteSection,
} from "../routes/project-route-paths.js";

interface ProjectManagerProjectNavigationProps {
  currentSection: ProjectRouteSection;
  projectId: number | null;
}

const DETAIL_LABEL = "Details";
const GANTT_LABEL = "Gantt";
const ISSUES_LABEL = "Issues";

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
    case "issues":
      return createProjectIssuesRoute(projectId);
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
    <Tabs onChange={handleSectionChange} value={props.currentSection}>
      <Tab disabled={props.projectId === null} label={DETAIL_LABEL} value="detail" />
      <Tab disabled={props.projectId === null} label={GANTT_LABEL} value="gantt" />
      <Tab disabled={props.projectId === null} label={ISSUES_LABEL} value="issues" />
    </Tabs>
  );
}
