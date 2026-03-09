import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { IssueDeleteButton } from "../../../common/components/entity-actions/IssueDeleteButton.js";
import { IssueEditButton } from "../../../common/components/entity-actions/IssueEditButton.js";
import { IssueViewButton } from "../../../common/components/entity-actions/IssueViewButton.js";
import { IssueListItem } from "../../../common/components/entity-list/IssueListItem.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { isApiError } from "../../../common/api/api-error.js";
import { issuesApi } from "../api/issues-api.js";
import type {
  Issue,
  UpdateIssueRequest,
} from "../contracts/issue.contracts.js";
import { IssueDetailsCard } from "../components/issues/IssueDetailsCard.js";
import { IssueEditModal } from "../components/issues/IssueEditModal.js";
import { IssueSummaryModal } from "../components/issues/IssueSummaryModal.js";

interface ProjectManagerIssuePageProps {
  issueId: number | null;
  projectId: number | null;
  token: string;
}

const VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const DEFAULT_ERROR_MESSAGE = "Unable to load that issue right now.";
const MISSING_ROUTE_MESSAGE = "Provide both a valid issue id and projectId to view an issue.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Issue Detail";

function buildErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error) && error.responseBody) {
    return error.responseBody;
  }

  return fallback;
}

export function ProjectManagerIssuePage(props: ProjectManagerIssuePageProps) {
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.issueId !== null && props.projectId !== null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [issueSummaryRefreshKey, setIssueSummaryRefreshKey] = useState(0);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  useEffect(() => {
    if (props.issueId === null || props.projectId === null) {
      setIssue(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadIssue(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await issuesApi.getIssue(props.token, props.projectId!, props.issueId!);
        if (isMounted) {
          setIssue(response.issue);
        }
      } catch (error) {
        if (isMounted) {
          setIssue(null);
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadIssue();

    return () => {
      isMounted = false;
    };
  }, [props.issueId, props.projectId, props.token]);

  function goBackToIssues(): void {
    if (props.projectId === null) {
      navigate("/pm/issues");
      return;
    }

    navigate(`/pm/issues?projectId=${props.projectId}`);
  }

  async function handleUpdateIssue(
    issueId: number,
    payload: UpdateIssueRequest,
  ): Promise<Issue> {
    if (props.projectId === null) {
      throw new Error(MISSING_ROUTE_MESSAGE);
    }

    setBusyKey(`issue:${issueId}`);
    try {
      const response = await issuesApi.updateIssue(props.token, props.projectId, issueId, payload);
      setIssue(response.issue);
      setIssueSummaryRefreshKey((current) => current + 1);
      return response.issue;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteIssue(issueId: number): Promise<void> {
    if (props.projectId === null) {
      return;
    }

    setBusyKey(`issue:${issueId}`);
    setErrorMessage(null);

    try {
      await issuesApi.deleteIssue(props.token, props.projectId, issueId);
      goBackToIssues();
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to delete that issue."));
    } finally {
      setBusyKey(null);
    }
  }

  function renderContent() {
    if (props.issueId === null || props.projectId === null) {
      return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading issue detail...</Typography>
        </Stack>
      );
    }

    if (!issue) {
      return <Alert severity="error">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</Alert>;
    }

    return (
      <Stack spacing={2}>
        <IssueListItem
          actionContent={(
            <>
              <IssueViewButton
                disabled={busyKey === `issue:${issue.id}`}
                onClick={() => setIsSummaryModalOpen(true)}
              />
              <IssueEditButton
                disabled={busyKey === `issue:${issue.id}`}
                onClick={() => setIsEditModalOpen(true)}
              />
              <IssueDeleteButton
                disabled={busyKey === `issue:${issue.id}`}
                onClick={() => void handleDeleteIssue(issue.id)}
              />
            </>
          )}
          issue={issue}
          onNavigate={() => navigate(`/pm/issue?id=${issue.id}&projectId=${issue.projectId}`)}
          viewMode={VIEW_MODE}
        />
        <IssueDetailsCard issue={issue} />
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        justifyContent: "center",
        padding: { xs: 1.5, sm: 2 },
        width: "100%",
      }}
    >
      <Stack spacing={2.5} sx={{ flex: 1, maxWidth: 1240, width: "100%" }}>
        <Stack spacing={0.75}>
          <Typography color="primary" variant="overline" sx={{ letterSpacing: "0.14em" }}>
            {PAGE_OVERLINE}
          </Typography>
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {props.projectId ?? "None"}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected issue: {props.issueId ?? "None"}
          </Typography>
        </Stack>
        <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h6">Issue detail with summary preview</Typography>
          <Button onClick={goBackToIssues} type="button" variant="outlined">
            Back to Issues
          </Button>
        </Stack>
        {errorMessage && issue ? <Alert severity="error">{errorMessage}</Alert> : null}
        {renderContent()}
      </Stack>
      <IssueEditModal
        isBusy={issue !== null && busyKey === `issue:${issue.id}`}
        isOpen={isEditModalOpen}
        issue={issue}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleUpdateIssue}
      />
      <IssueSummaryModal
        isOpen={isSummaryModalOpen}
        issueId={props.issueId}
        onClose={() => setIsSummaryModalOpen(false)}
        projectId={props.projectId}
        refreshKey={issueSummaryRefreshKey}
        token={props.token}
      />
    </Box>
  );
}
