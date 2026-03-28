import React from "react";
import {
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { ParsedProjectTaskDetail } from "../../lib/project-tasks-history-parser.js";
import { TaskMarkdownRender } from "./TaskMarkdownRender.js";

interface TaskDetailsCardProps {
  projectId: number;
  task: ParsedProjectTaskDetail;
  token: string;
}

const EMPTY_DESCRIPTION_MESSAGE = "No description provided.";

function createStatusColor(status: ParsedProjectTaskDetail["status"]) {
  switch (status) {
    case "ISSUE_STATUS_CLOSED":
      return "success";
    case "ISSUE_STATUS_BLOCKED":
      return "warning";
    case "ISSUE_STATUS_IN_PROGRESS":
      return "info";
    default:
      return "primary";
  }
}

function createStatusLabel(status: ParsedProjectTaskDetail["status"]): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase().replace("_", " ");
}

function createTaskTypeLabel(type: ParsedProjectTaskDetail["type"]): string {
  return type === "milestone" ? "Milestone" : "Task";
}

function formatStartDate(startDate: string | null): string {
  return startDate === null ? "N/A" : new Date(startDate).toLocaleString();
}

function renderDescription(
  description: string,
  projectId: number,
  taskId: string,
  token: string,
): React.ReactNode {
  if (!description.trim()) {
    return (
      <Typography color="text.secondary" variant="body2">
        {EMPTY_DESCRIPTION_MESSAGE}
      </Typography>
    );
  }

  return (
    <TaskMarkdownRender
      markdown={description}
      projectId={projectId}
      taskId={taskId}
      token={token}
    />
  );
}

export function TaskDetailsCard(props: TaskDetailsCardProps) {
  const {
    projectId,
    task,
    token,
  } = props;

  return (
    <Paper elevation={0} sx={{ padding: 3 }}>
      <Stack spacing={1.5}>
        <Typography component="h2" variant="h5">
          Detailed Task View
        </Typography>
        <Typography variant="h6">{task.title}</Typography>
        <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
          <Chip
            color={createStatusColor(task.status)}
            label={createStatusLabel(task.status)}
            size="small"
            variant="outlined"
          />
          <Chip
            label={createTaskTypeLabel(task.type)}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`Progress ${task.progressPercentage}%`}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Typography variant="body2">
          Task ID:
          {" "}
          {task.id}
        </Typography>
        <Typography variant="body2">
          Started:
          {" "}
          {formatStartDate(task.startDate)}
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Description</Typography>
          {renderDescription(task.description, projectId, task.id, token)}
        </Stack>
      </Stack>
    </Paper>
  );
}
