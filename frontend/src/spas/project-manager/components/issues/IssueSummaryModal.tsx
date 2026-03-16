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
import { isApiError } from "../../../../common/api/api-error.js";
import { issuesApi } from "../../api/issues-api.js";
import type { GetIssueResponse } from "../../contracts/issue.contracts.js";
import {
  ISSUE_DIALOG_MAX_WIDTH,
  ISSUE_LOAD_ERROR_MESSAGE,
  ISSUE_SUMMARY_DIALOG_TITLE,
  ISSUE_SUMMARY_JOURNAL_PREVIEW_LENGTH,
} from "./issue-modal.constants.js";

interface IssueSummaryModalProps {
  isOpen: boolean;
  issueId: number | null;
  onClose(): void;
  projectId: number | null;
  refreshKey: number;
  token: string;
}

function buildIssueLoadErrorMessage(error: unknown): string {
  if (isApiError(error) && error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return ISSUE_LOAD_ERROR_MESSAGE;
}

function formatTimestamp(value: string | null): string {
  return value === null ? "Not closed" : new Date(value).toLocaleString();
}

function createJournalPreview(journal: string | null): string {
  if (!journal) {
    return "No journal notes yet.";
  }

  return journal.length <= ISSUE_SUMMARY_JOURNAL_PREVIEW_LENGTH
    ? journal
    : `${journal.slice(0, ISSUE_SUMMARY_JOURNAL_PREVIEW_LENGTH)}...`;
}

export function IssueSummaryModal(props: IssueSummaryModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [issueResponse, setIssueResponse] = useState<GetIssueResponse | null>(null);

  useEffect(() => {
    if (!props.isOpen || props.issueId === null || props.projectId === null) {
      return;
    }

    let isMounted = true;

    async function loadIssueSummary(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);
      setIssueResponse(null);

      try {
        const response = await issuesApi.getIssue(props.token, props.projectId!, props.issueId!);
        if (isMounted) {
          setIssueResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setIssueResponse(null);
          setErrorMessage(buildIssueLoadErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadIssueSummary();

    return () => {
      isMounted = false;
    };
  }, [props.isOpen, props.issueId, props.projectId, props.refreshKey, props.token]);

  return (
    <Dialog
      fullWidth
      maxWidth={ISSUE_DIALOG_MAX_WIDTH}
      onClose={props.onClose}
      open={props.isOpen}
    >
      <DialogTitle>{ISSUE_SUMMARY_DIALOG_TITLE}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography>Loading issue summary...</Typography>
          </Stack>
        ) : errorMessage ? (
          <Typography color="error.main">{errorMessage}</Typography>
        ) : issueResponse ? (
          <Stack spacing={1.25}>
            <Typography variant="h6">{issueResponse.issue.name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {issueResponse.issue.description ?? "No description provided."}
            </Typography>
            <Typography variant="body2">
              Status: {issueResponse.issue.status}
            </Typography>
            <Typography variant="body2">
              Priority: {issueResponse.issue.priority}
            </Typography>
            <Typography variant="body2">
              Progress: {issueResponse.issue.progressPercentage}%
            </Typography>
            <Typography variant="body2">
              Opened: {formatTimestamp(issueResponse.issue.openedAt)}
            </Typography>
            <Typography variant="body2">
              Closed: {formatTimestamp(issueResponse.issue.closedAt)}
            </Typography>
            <Typography variant="body2">
              Closed Reason: {issueResponse.issue.closedReason ?? "N/A"}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Journal Preview</Typography>
              <Typography variant="body2">
                {createJournalPreview(issueResponse.issue.journal)}
              </Typography>
            </Stack>
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
