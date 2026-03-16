import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectDeleteButton } from "../../../common/components/entity-actions/ProjectDeleteButton.js";
import { ProjectEditButton } from "../../../common/components/entity-actions/ProjectEditButton.js";
import { ProjectViewButton } from "../../../common/components/entity-actions/ProjectViewButton.js";
import { OrganizationViewButton } from "../../../common/components/entity-actions/OrganizationViewButton.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { UserListItem } from "../../../common/components/entity-list/UserListItem.js";
import { TeamViewButton } from "../../../common/components/entity-actions/TeamViewButton.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type {
  GetProjectResponse,
  LobbyProject,
  ProjectMember,
  ProjectManager,
  UpdateProjectRequest,
} from "../../../lobby/contracts/lobby.contracts.js";
import { OrganizationSummaryModal } from "../../../lobby/components/organization/OrganizationSummaryModal.js";
import { ProjectEditModal } from "../../../lobby/components/project/ProjectEditModal.js";
import { ProjectSummaryModal } from "../../../lobby/components/project/ProjectSummaryModal.js";
import { TeamSummaryModal } from "../../../lobby/components/team/TeamSummaryModal.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { ProjectDetailsCard } from "../components/projects/ProjectDetailsCard.js";
import { createProjectIssuesRoute } from "../routes/project-route-paths.js";

interface ProjectManagerProjectPageProps {
  currentUserId?: number;
  projectId: number | null;
  token: string;
}

const DEFAULT_ERROR_MESSAGE = "Unable to load that project right now.";
const DETAIL_SOURCE_LABEL = "Direct";
const TEAM_SOURCE_LABEL = "Team";
const ORGANIZATION_SOURCE_LABEL = "Org";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const LINK_ONLY_VIEW_MODE: EntityListItemViewMode = "link-only-no-action-buttons";
const MISSING_ROUTE_MESSAGE = "Provide a valid projectId to view a project.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project";
const PROJECT_DELETE_ERROR_MESSAGE = "Unable to delete that project.";
const PROJECT_OWNERS_HEADING = "Project Owners";
const PROJECT_MANAGERS_HEADING = "Project Managers";
const DETAILS_TAB_LABEL = "Details";
const TEAMS_TAB_LABEL = "Teams";
const ORGANIZATIONS_TAB_LABEL = "Organizations";

type ProjectDetailsTabValue = "details" | "organizations" | "teams";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? "None" : `${projectId}`;
}

function createProjectEntity(response: GetProjectResponse): LobbyProject {
  return response.project;
}

function createProjectManagerSourceLabels(sourceKinds: readonly string[]): string[] {
  return sourceKinds.map((sourceKind) => {
    switch (sourceKind) {
      case "direct":
        return DETAIL_SOURCE_LABEL;
      case "team":
        return TEAM_SOURCE_LABEL;
      case "org":
        return ORGANIZATION_SOURCE_LABEL;
      default:
        return sourceKind;
    }
  });
}

function hasRoleCode(member: ProjectMember, roleCode: string): boolean {
  return member.roleCodes.includes(roleCode);
}

function createProjectOwners(
  response: GetProjectResponse,
): Array<{ userId: number; username: string }> {
  return response.members
    .filter((member) => hasRoleCode(member, "GGTC_PROJECTROLE_PROJECT_OWNER"))
    .map((member) => ({
      userId: member.userId,
      username: member.username,
    }));
}

function canEditProject(
  currentUserId: number | undefined,
  response: GetProjectResponse | null,
): boolean {
  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.members.some(
    (member) =>
      member.userId === currentUserId &&
      hasRoleCode(member, "GGTC_PROJECTROLE_PROJECT_OWNER"),
  ) || response.projectManagers.some(
    (projectManager) => projectManager.userId === currentUserId,
  );
}

function canDeleteProject(
  currentUserId: number | undefined,
  response: GetProjectResponse | null,
): boolean {
  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.members.some(
    (member) =>
      member.userId === currentUserId &&
      hasRoleCode(member, "GGTC_PROJECTROLE_PROJECT_OWNER"),
  );
}

function renderUserLinkList<T extends { userId: number; username: string }>(
  users: ReadonlyArray<T>,
  renderSupplementaryContent?: (
    entry: T,
  ) => React.ReactNode,
) {
  return (
    <EntityItemList viewMode={LINK_ONLY_VIEW_MODE}>
      {users.map((entry) => (
        <UserListItem
          key={entry.userId}
          user={{
            id: entry.userId,
            username: entry.username,
          }}
          viewMode={LINK_ONLY_VIEW_MODE}
        >
          {renderSupplementaryContent ? renderSupplementaryContent(entry) : null}
        </UserListItem>
      ))}
    </EntityItemList>
  );
}

export function ProjectManagerProjectPage(props: ProjectManagerProjectPageProps) {
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [activeTab, setActiveTab] = useState<ProjectDetailsTabValue>("details");
  const [organizationSummaryTargetId, setOrganizationSummaryTargetId] = useState<number | null>(null);
  const [projectResponse, setProjectResponse] = useState<GetProjectResponse | null>(null);
  const [projectSummaryRefreshKey, setProjectSummaryRefreshKey] = useState(0);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [teamSummaryTargetId, setTeamSummaryTargetId] = useState<number | null>(null);

  const project = projectResponse ? createProjectEntity(projectResponse) : null;
  const projectOwners = projectResponse ? createProjectOwners(projectResponse) : [];
  const allowProjectEdit = canEditProject(props.currentUserId, projectResponse);
  const allowProjectDelete = canDeleteProject(props.currentUserId, projectResponse);

  useEffect(() => {
    if (props.projectId === null) {
      setProjectResponse(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadProject(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await lobbyApi.getProject(props.token, props.projectId!);
        if (isMounted) {
          setProjectResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setProjectResponse(null);
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token, projectSummaryRefreshKey]);

  function navigateToIssues(): void {
    if (props.projectId === null) {
      navigate("/pm/project/issues");
      return;
    }

    navigate(createProjectIssuesRoute(props.projectId));
  }

  async function handleUpdateProject(
    projectId: number,
    payload: UpdateProjectRequest,
  ): Promise<LobbyProject> {
    setBusyKey(`project:${projectId}`);
    try {
      const response = await lobbyApi.updateProject(props.token, projectId, payload);
      setProjectResponse((current) => (
        current
          ? {
              ...current,
              project: response.project,
            }
          : current
      ));
      setProjectSummaryRefreshKey((current) => current + 1);
      return response.project;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteProject(projectId: number): Promise<void> {
    setBusyKey(`project:${projectId}`);
    setErrorMessage(null);

    try {
      await lobbyApi.deleteProject(props.token, projectId);
      navigateToIssues();
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, PROJECT_DELETE_ERROR_MESSAGE));
    } finally {
      setBusyKey(null);
    }
  }

  function renderProjectContent() {
    if (props.projectId === null) {
      return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading project...</Typography>
        </Stack>
      );
    }

    if (!projectResponse || !project) {
      return <Alert severity="error">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</Alert>;
    }

    switch (activeTab) {
      case "teams":
        return (
          <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
            {projectResponse.teams.map((team) => (
              <TeamListItem
                actionContent={(
                  <TeamViewButton
                    onClick={() => setTeamSummaryTargetId(team.id)}
                  />
                )}
                key={team.id}
                team={team}
                viewMode={LIST_ITEM_VIEW_MODE}
              />
            ))}
          </EntityItemList>
        );
      case "organizations":
        return (
          <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
            {projectResponse.organizations.map((organization) => (
              <OrganizationListItem
                actionContent={(
                  <OrganizationViewButton
                    onClick={() => setOrganizationSummaryTargetId(organization.id)}
                  />
                )}
                key={organization.id}
                organization={organization}
                viewMode={LIST_ITEM_VIEW_MODE}
              />
            ))}
          </EntityItemList>
        );
      case "details":
      default:
        return (
          <Stack spacing={2}>
            <ProjectDetailsCard projectResponse={projectResponse} />
            <Stack spacing={1.25}>
              <Typography component="h2" variant="h6">
                {PROJECT_OWNERS_HEADING}
              </Typography>
              {projectOwners.length > 0 ? renderUserLinkList(projectOwners) : (
                <Typography color="text.secondary" variant="body2">
                  No direct project owners are currently listed.
                </Typography>
              )}
            </Stack>
            <Stack spacing={1.25}>
              <Typography component="h2" variant="h6">
                {PROJECT_MANAGERS_HEADING}
              </Typography>
              {renderUserLinkList(
                projectResponse.projectManagers,
                (projectManager: ProjectManager) => (
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {createProjectManagerSourceLabels(projectManager.sourceKinds).map((label) => (
                      <Chip key={`${projectManager.userId}-${label}`} label={label} size="small" />
                    ))}
                  </Stack>
                ),
              )}
            </Stack>
          </Stack>
        );
    }
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
      <Stack spacing={2.5} sx={{ flex: 1, maxWidth: 1360, width: "100%" }}>
        <Stack spacing={0.75}>
          <Typography color="primary" variant="overline" sx={{ letterSpacing: "0.14em" }}>
            {PAGE_OVERLINE}
          </Typography>
          <ProjectManagerProjectNavigation currentSection="detail" projectId={props.projectId} />
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {createSelectedProjectLabel(props.projectId)}
          </Typography>
        </Stack>
        {project ? (
          <ProjectListItem
            actionContent={(
              <>
                <ProjectViewButton
                  disabled={busyKey === `project:${project.id}`}
                  onClick={() => setIsSummaryModalOpen(true)}
                />
                {allowProjectEdit ? (
                  <ProjectEditButton
                    disabled={busyKey === `project:${project.id}`}
                    onClick={() => setIsEditModalOpen(true)}
                  />
                ) : null}
                {allowProjectDelete ? (
                  <ProjectDeleteButton
                    disabled={busyKey === `project:${project.id}`}
                    onClick={() => void handleDeleteProject(project.id)}
                  />
                ) : null}
              </>
            )}
            onNavigate={() => undefined}
            project={project}
            viewMode={LIST_ITEM_VIEW_MODE}
          />
        ) : null}
        <Tabs
          onChange={(_event, nextValue: ProjectDetailsTabValue) => setActiveTab(nextValue)}
          value={activeTab}
        >
          <Tab label={DETAILS_TAB_LABEL} value="details" />
          <Tab label={TEAMS_TAB_LABEL} value="teams" />
          <Tab label={ORGANIZATIONS_TAB_LABEL} value="organizations" />
        </Tabs>
        {errorMessage && project ? <Alert severity="error">{errorMessage}</Alert> : null}
        {renderProjectContent()}
      </Stack>
      <ProjectEditModal
        isBusy={project !== null && busyKey === `project:${project.id}`}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleUpdateProject}
        project={project}
      />
      <ProjectSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        projectId={props.projectId}
        refreshKey={projectSummaryRefreshKey}
        token={props.token}
      />
      <TeamSummaryModal
        isOpen={teamSummaryTargetId !== null}
        onClose={() => setTeamSummaryTargetId(null)}
        refreshKey={projectSummaryRefreshKey}
        teamId={teamSummaryTargetId}
        token={props.token}
      />
      <OrganizationSummaryModal
        isOpen={organizationSummaryTargetId !== null}
        onClose={() => setOrganizationSummaryTargetId(null)}
        organizationId={organizationSummaryTargetId}
        refreshKey={projectSummaryRefreshKey}
        token={props.token}
      />
    </Box>
  );
}
