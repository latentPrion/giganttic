import CloseIcon from "@mui/icons-material/Close";
import React from "react";
import {
  Box,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  createProjectDetailRoute,
  createProjectGanttRoute,
  createProjectIssueRoute,
  createProjectKanbanRoute,
  createProjectIssuesRoute,
  createProjectTasksRoute,
  type ProjectRouteSection,
} from "../routes/project-route-paths.js";

export interface ProjectIssueDetailTabContext {
  issueId: number;
  onCloseIssueTab: () => void;
}

interface ProjectManagerProjectNavigationProps {
  actions?: React.ReactNode;
  currentSection: ProjectRouteSection;
  issueDetailContext?: ProjectIssueDetailTabContext | null;
  projectId: number | null;
}

const PROJECT_WORKSPACE_TABLIST_LABEL = "Project workspace sections";

const DETAIL_LABEL = "Details";
const GANTT_LABEL = "Gantt";
const KANBAN_LABEL = "Kanban Board";
const ISSUES_LABEL = "Issues";
const TASKS_LABEL = "Tasks";

function buildRouteForSection(
  currentSection: ProjectRouteSection,
  projectId: number | null,
  issueDetailIssueId?: number | null,
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
    case "issue-detail":
      if (issueDetailIssueId == null) {
        return createProjectIssuesRoute(projectId);
      }
      return createProjectIssueRoute(projectId, issueDetailIssueId);
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

    const issueDetailId = props.issueDetailContext?.issueId ?? null;
    navigate(
      buildRouteForSection(nextSection, props.projectId, issueDetailId),
    );
  }

  function renderIssueDetailTabLabel(): React.ReactNode {
    if (!props.issueDetailContext || props.projectId === null) {
      return null;
    }

    const { issueId, onCloseIssueTab } = props.issueDetailContext;

    return (
      <Stack alignItems="center" direction="row" spacing={0.5} component="span">
        <Typography component="span" variant="button" sx={{ lineHeight: 1.2 }}>
          Issue #
          {issueId}
        </Typography>
        <Box
          aria-label="Close issue tab and return to issues list"
          component="span"
          onClick={(event) => {
            event.stopPropagation();
            onCloseIssueTab();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onCloseIssueTab();
            }
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
          role="button"
          sx={{
            cursor: "pointer",
            display: "inline-flex",
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
          }}
          tabIndex={0}
        >
          <CloseIcon fontSize="small" />
        </Box>
      </Stack>
    );
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
        aria-label={PROJECT_WORKSPACE_TABLIST_LABEL}
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
        {props.issueDetailContext && props.projectId !== null ? (
          <Tab label={renderIssueDetailTabLabel()} value="issue-detail" />
        ) : null}
      </Tabs>
      {props.actions ? (
        <Box sx={{ flexShrink: 0, minWidth: 0, width: { xs: "100%", md: "auto" } }}>
          {props.actions}
        </Box>
      ) : null}
    </Box>
  );
}
