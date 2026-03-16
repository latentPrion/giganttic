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

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../api/lobby-api.js";
import type { GetOrganizationResponse } from "../../contracts/lobby.contracts.js";
import {
  ORGANIZATION_DIALOG_MAX_WIDTH,
  ORGANIZATION_LOAD_ERROR_MESSAGE,
  ORGANIZATION_SUMMARY_DIALOG_TITLE,
} from "./organization-modal.constants.js";
import {
  createOrganizationMemberPreview,
  formatOrganizationSummaryTimestamp,
} from "./organization-modal.utils.js";

interface OrganizationSummaryModalProps {
  isOpen: boolean;
  onClose(): void;
  organizationId: number | null;
  refreshKey: number;
  token: string;
}

function buildOrganizationLoadErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, ORGANIZATION_LOAD_ERROR_MESSAGE);
}

export function OrganizationSummaryModal(props: OrganizationSummaryModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [organizationResponse, setOrganizationResponse] =
    useState<GetOrganizationResponse | null>(null);

  useEffect(() => {
    if (!props.isOpen || props.organizationId === null) {
      return;
    }

    let isMounted = true;
    const activeOrganizationId = props.organizationId;

    async function loadOrganizationSummary(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);
      setOrganizationResponse(null);

      try {
        const response = await lobbyApi.getOrganization(props.token, activeOrganizationId);
        if (isMounted) {
          setOrganizationResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setOrganizationResponse(null);
          setErrorMessage(buildOrganizationLoadErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrganizationSummary();

    return () => {
      isMounted = false;
    };
  }, [props.isOpen, props.organizationId, props.refreshKey, props.token]);

  const memberPreview = organizationResponse
    ? createOrganizationMemberPreview(organizationResponse)
    : [];

  return (
    <Dialog
      fullWidth
      maxWidth={ORGANIZATION_DIALOG_MAX_WIDTH}
      onClose={props.onClose}
      open={props.isOpen}
    >
      <DialogTitle>{ORGANIZATION_SUMMARY_DIALOG_TITLE}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography>Loading organization summary...</Typography>
          </Stack>
        ) : errorMessage ? (
          <Typography color="error.main">{errorMessage}</Typography>
        ) : organizationResponse ? (
          <Stack spacing={1.25}>
            <Typography variant="h6">{organizationResponse.organization.name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {organizationResponse.organization.description ?? "No description provided."}
            </Typography>
            <Typography variant="body2">
              Created: {formatOrganizationSummaryTimestamp(
                organizationResponse.organization.createdAt,
              )}
            </Typography>
            <Typography variant="body2">
              Updated: {formatOrganizationSummaryTimestamp(
                organizationResponse.organization.updatedAt,
              )}
            </Typography>
            <Typography variant="body2">
              Members: {organizationResponse.members.length}
            </Typography>
            <Typography variant="body2">
              Projects: {organizationResponse.projects.length}
            </Typography>
            <Typography variant="body2">
              Teams: {organizationResponse.teams.length}
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
