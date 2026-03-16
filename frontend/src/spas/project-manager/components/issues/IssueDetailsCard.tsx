import React from "react";
import {
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { Issue } from "../../contracts/issue.contracts.js";

interface IssueDetailsCardProps {
  issue: Issue;
}

function formatTimestamp(value: string | null): string {
  return value === null ? "N/A" : new Date(value).toLocaleString();
}

export function IssueDetailsCard(props: IssueDetailsCardProps) {
  return (
    <Paper elevation={0} sx={{ padding: 3 }}>
      <Stack spacing={1.5}>
        <Typography component="h2" variant="h5">
          Detailed Issue View
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {props.issue.description ?? "No description provided."}
        </Typography>
        <Typography variant="body2">Status: {props.issue.status}</Typography>
        <Typography variant="body2">Priority: {props.issue.priority}</Typography>
        <Typography variant="body2">
          Progress: {props.issue.progressPercentage}%
        </Typography>
        <Typography variant="body2">
          Opened: {formatTimestamp(props.issue.openedAt)}
        </Typography>
        <Typography variant="body2">
          Closed: {formatTimestamp(props.issue.closedAt)}
        </Typography>
        <Typography variant="body2">
          Closed Reason: {props.issue.closedReason ?? "N/A"}
        </Typography>
        <Typography variant="body2">
          Closed Reason Details: {props.issue.closedReasonDescription ?? "N/A"}
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Journal</Typography>
          <Typography variant="body2">
            {props.issue.journal ?? "No journal notes yet."}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
