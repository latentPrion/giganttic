import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

import { isApiError } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../api/lobby-api.js";
import type { GetProjectResponse } from "../../contracts/lobby.contracts.js";
import {
  PROJECT_DIALOG_MAX_WIDTH,
  PROJECT_LOAD_ERROR_MESSAGE,
  PROJECT_SUMMARY_DIALOG_TITLE,
  PROJECT_SUMMARY_MEMBER_PREVIEW_LIMIT,
} from "./project-modal.constants.js";

interface ProjectSummaryModalProps {
  isOpen: boolean;
  onClose(): void;
  projectId: number | null;
  refreshKey: number;
  token: string;
}

function buildProjectLoadErrorMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return PROJECT_LOAD_ERROR_MESSAGE;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function createMemberPreview(response: GetProjectResponse): string[] {
  return response.members
    .slice(0, PROJECT_SUMMARY_MEMBER_PREVIEW_LIMIT)
    .map((member) => `${member.username} (${member.roleCodes.join(", ") || "member"})`);
}

export function ProjectSummaryModal(props: ProjectSummaryModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [projectResponse, setProjectResponse] = useState<GetProjectResponse | null>(null);

  useEffect(() => {
    if (!props.isOpen || props.projectId === null) {
      return;
    }

    let isMounted = true;

    async function loadProjectSummary(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);
      setProjectResponse(null);

      try {
        const response = await lobbyApi.getProject(props.token, props.projectId!);
        if (isMounted) {
          setProjectResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setProjectResponse(null);
          setErrorMessage(buildProjectLoadErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProjectSummary();

    return () => {
      isMounted = false;
    };
  }, [props.isOpen, props.projectId, props.refreshKey, props.token]);

  const memberPreview = projectResponse ? createMemberPreview(projectResponse) : [];

  return (
    <Dialog
      fullWidth
      maxWidth={PROJECT_DIALOG_MAX_WIDTH}
      onClose={props.onClose}
      open={props.isOpen}
    >
      <DialogTitle>{PROJECT_SUMMARY_DIALOG_TITLE}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography>Loading project summary...</Typography>
          </Stack>
        ) : errorMessage ? (
          <Typography color="error.main">{errorMessage}</Typography>
        ) : projectResponse ? (
          <Stack spacing={1.25}>
            <Typography variant="h6">{projectResponse.project.name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {projectResponse.project.description ?? "No description provided."}
            </Typography>
            <Typography variant="body2">
              Created: {formatTimestamp(projectResponse.project.createdAt)}
            </Typography>
            <Typography variant="body2">
              Updated: {formatTimestamp(projectResponse.project.updatedAt)}
            </Typography>
            <Typography variant="body2">
              Members: {projectResponse.members.length}
            </Typography>
            {memberPreview.length > 0 ? (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Member Preview</Typography>
                {memberPreview.map((memberLabel) => (
                  <Typography key={memberLabel} variant="body2">
                    {memberLabel}
                  </Typography>
                ))}
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ padding: 3, paddingTop: 1 }}>
        <Button onClick={props.onClose} type="button">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
