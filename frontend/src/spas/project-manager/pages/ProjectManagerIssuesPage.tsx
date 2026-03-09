import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { IssueCreateButton } from "../../../common/components/entity-actions/IssueCreateButton.js";
import { IssueDeleteButton } from "../../../common/components/entity-actions/IssueDeleteButton.js";
import { IssueEditButton } from "../../../common/components/entity-actions/IssueEditButton.js";
import { IssueViewButton } from "../../../common/components/entity-actions/IssueViewButton.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import { IssueListItem } from "../../../common/components/entity-list/IssueListItem.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { isApiError } from "../../../common/api/api-error.js";
import { issuesApi } from "../api/issues-api.js";
import type {
  CreateIssueRequest,
  Issue,
  UpdateIssueRequest,
} from "../contracts/issue.contracts.js";
import { IssueCreateModal } from "../components/issues/IssueCreateModal.js";
import { IssueEditModal } from "../components/issues/IssueEditModal.js";
import { IssueSummaryModal } from "../components/issues/IssueSummaryModal.js";

interface ProjectManagerIssuesPageProps {
  projectId: number | null;
  token: string;
}

const VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const DEFAULT_ERROR_MESSAGE = "Unable to load project issues right now.";
const EMPTY_ISSUES_MESSAGE = "No issues exist for the selected project yet.";
const MISSING_PROJECT_MESSAGE = "Select a valid project to view its issues.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project Issues";

function buildErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error) && error.responseBody) {
    return error.responseBody;
  }

  return fallback;
}

function sortIssuesById(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => left.id - right.id);
}

function upsertIssueById(issues: Issue[], issue: Issue): Issue[] {
  return sortIssuesById([...issues.filter((entry) => entry.id !== issue.id), issue]);
}

export function ProjectManagerIssuesPage(props: ProjectManagerIssuesPageProps) {
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [issueEditTargetId, setIssueEditTargetId] = useState<number | null>(null);
  const [issueSummaryRefreshKey, setIssueSummaryRefreshKey] = useState(0);
  const [issueSummaryTargetId, setIssueSummaryTargetId] = useState<number | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  const issueEditTarget = useMemo(
    () => issues.find((issue) => issue.id === issueEditTargetId) ?? null,
    [issueEditTargetId, issues],
  );

  useEffect(() => {
    if (props.projectId === null) {
      setIssues([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadIssues(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await issuesApi.listIssues(props.token, props.projectId!);
        if (isMounted) {
          setIssues(sortIssuesById(response.issues));
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
          setIssues([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadIssues();

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token]);

  function closeCreateModal(): void {
    setIsCreateModalOpen(false);
  }

  function closeEditModal(): void {
    setIssueEditTargetId(null);
  }

  function closeSummaryModal(): void {
    setIssueSummaryTargetId(null);
  }

  function openSummaryModal(issueId: number): void {
    setIssueSummaryTargetId(issueId);
  }

  function openEditModal(issueId: number): void {
    setIssueEditTargetId(issueId);
  }

  function openDetailRoute(issueId: number): void {
    if (props.projectId === null) {
      return;
    }

    navigate(`/pm/issue?id=${issueId}&projectId=${props.projectId}`);
  }

  async function handleCreateIssue(payload: CreateIssueRequest): Promise<Issue> {
    if (props.projectId === null) {
      throw new Error(MISSING_PROJECT_MESSAGE);
    }

    setBusyKey("create-issue");
    try {
      const response = await issuesApi.createIssue(props.token, props.projectId, payload);
      setIssues((current) => upsertIssueById(current, response.issue));
      return response.issue;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUpdateIssue(
    issueId: number,
    payload: UpdateIssueRequest,
  ): Promise<Issue> {
    if (props.projectId === null) {
      throw new Error(MISSING_PROJECT_MESSAGE);
    }

    setBusyKey(`issue:${issueId}`);
    try {
      const response = await issuesApi.updateIssue(props.token, props.projectId, issueId, payload);
      setIssues((current) => upsertIssueById(current, response.issue));
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
      setIssues((current) => current.filter((issue) => issue.id !== issueId));
      if (issueSummaryTargetId === issueId) {
        closeSummaryModal();
      }
      if (issueEditTargetId === issueId) {
        closeEditModal();
      }
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to delete that issue."));
    } finally {
      setBusyKey(null);
    }
  }

  function renderContent() {
    if (props.projectId === null) {
      return (
        <Alert severity="info">{MISSING_PROJECT_MESSAGE}</Alert>
      );
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading issues...</Typography>
        </Stack>
      );
    }

    if (issues.length === 0) {
      return (
        <Typography color="text.secondary" variant="body2">
          {EMPTY_ISSUES_MESSAGE}
        </Typography>
      );
    }

    return (
      <EntityItemList viewMode={VIEW_MODE}>
        {issues.map((issue) => (
          <IssueListItem
            actionContent={(
              <>
                <IssueViewButton
                  disabled={busyKey === `issue:${issue.id}`}
                  onClick={() => openDetailRoute(issue.id)}
                />
                <IssueEditButton
                  disabled={busyKey === `issue:${issue.id}`}
                  onClick={() => openEditModal(issue.id)}
                />
                <IssueDeleteButton
                  disabled={busyKey === `issue:${issue.id}`}
                  onClick={() => void handleDeleteIssue(issue.id)}
                />
              </>
            )}
            issue={issue}
            key={issue.id}
            onOpenSummary={() => openSummaryModal(issue.id)}
            viewMode={VIEW_MODE}
          />
        ))}
      </EntityItemList>
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
        </Stack>
        <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h6">All issues for the current project</Typography>
          <IssueCreateButton
            disabled={props.projectId === null || busyKey === "create-issue"}
            onClick={() => setIsCreateModalOpen(true)}
          />
        </Stack>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {renderContent()}
      </Stack>
      <IssueCreateModal
        isBusy={busyKey === "create-issue"}
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onCreate={handleCreateIssue}
      />
      <IssueEditModal
        isBusy={issueEditTarget !== null && busyKey === `issue:${issueEditTarget.id}`}
        isOpen={issueEditTarget !== null}
        issue={issueEditTarget}
        onClose={closeEditModal}
        onUpdate={handleUpdateIssue}
      />
      <IssueSummaryModal
        isOpen={issueSummaryTargetId !== null}
        issueId={issueSummaryTargetId}
        onClose={closeSummaryModal}
        projectId={props.projectId}
        refreshKey={issueSummaryRefreshKey}
        token={props.token}
      />
    </Box>
  );
}
