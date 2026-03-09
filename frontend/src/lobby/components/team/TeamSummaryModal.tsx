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
import type { GetTeamResponse } from "../../contracts/lobby.contracts.js";
import {
  TEAM_DIALOG_MAX_WIDTH,
  TEAM_LOAD_ERROR_MESSAGE,
  TEAM_SUMMARY_DIALOG_TITLE,
} from "./team-modal.constants.js";
import {
  createTeamMemberPreview,
  formatTeamSummaryTimestamp,
} from "./team-modal.utils.js";

interface TeamSummaryModalProps {
  isOpen: boolean;
  onClose(): void;
  refreshKey: number;
  teamId: number | null;
  token: string;
}

function buildTeamLoadErrorMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return TEAM_LOAD_ERROR_MESSAGE;
}

export function TeamSummaryModal(props: TeamSummaryModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [teamResponse, setTeamResponse] = useState<GetTeamResponse | null>(null);

  useEffect(() => {
    if (!props.isOpen || props.teamId === null) {
      return;
    }

    let isMounted = true;
    const activeTeamId = props.teamId;

    async function loadTeamSummary(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);
      setTeamResponse(null);

      try {
        const response = await lobbyApi.getTeam(props.token, activeTeamId);
        if (isMounted) {
          setTeamResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setTeamResponse(null);
          setErrorMessage(buildTeamLoadErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTeamSummary();

    return () => {
      isMounted = false;
    };
  }, [props.isOpen, props.refreshKey, props.teamId, props.token]);

  const memberPreview = teamResponse ? createTeamMemberPreview(teamResponse) : [];

  return (
    <Dialog
      fullWidth
      maxWidth={TEAM_DIALOG_MAX_WIDTH}
      onClose={props.onClose}
      open={props.isOpen}
    >
      <DialogTitle>{TEAM_SUMMARY_DIALOG_TITLE}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography>Loading team summary...</Typography>
          </Stack>
        ) : errorMessage ? (
          <Typography color="error.main">{errorMessage}</Typography>
        ) : teamResponse ? (
          <Stack spacing={1.25}>
            <Typography variant="h6">{teamResponse.team.name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {teamResponse.team.description ?? "No description provided."}
            </Typography>
            <Typography variant="body2">
              Created: {formatTeamSummaryTimestamp(teamResponse.team.createdAt)}
            </Typography>
            <Typography variant="body2">
              Updated: {formatTeamSummaryTimestamp(teamResponse.team.updatedAt)}
            </Typography>
            <Typography variant="body2">
              Members: {teamResponse.members.length}
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
