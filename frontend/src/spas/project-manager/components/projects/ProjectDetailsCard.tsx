import React from "react";
import {
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { GetProjectResponse } from "../../../../lobby/contracts/lobby.contracts.js";

interface ProjectDetailsCardProps {
  projectResponse: GetProjectResponse;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function createRoleLabel(roleCodes: string[]): string {
  return roleCodes.length === 0 ? "member" : roleCodes.join(", ");
}

function createJournalText(journal: string | null | undefined): string {
  return journal ?? "No journal entries yet.";
}

export function ProjectDetailsCard(props: ProjectDetailsCardProps) {
  return (
    <Paper elevation={0} sx={{ padding: 3 }}>
      <Stack spacing={1.5}>
        <Typography component="h2" variant="h5">
          Detailed Project View
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {props.projectResponse.project.description ?? "No description provided."}
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Journal</Typography>
          <Typography color="text.secondary" variant="body2">
            {createJournalText(props.projectResponse.project.journal)}
          </Typography>
        </Stack>
        <Typography variant="body2">
          Project ID: {props.projectResponse.project.id}
        </Typography>
        <Typography variant="body2">
          Created: {formatTimestamp(props.projectResponse.project.createdAt)}
        </Typography>
        <Typography variant="body2">
          Updated: {formatTimestamp(props.projectResponse.project.updatedAt)}
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Members</Typography>
          {props.projectResponse.members.map((member) => (
            <Typography key={member.userId} variant="body2">
              {member.username} ({createRoleLabel(member.roleCodes)})
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
