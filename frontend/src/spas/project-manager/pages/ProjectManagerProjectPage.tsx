import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { OrganizationViewButton } from "../../../common/components/entity-actions/OrganizationViewButton.js";
import { ProjectDeleteButton } from "../../../common/components/entity-actions/ProjectDeleteButton.js";
import { ProjectEditButton } from "../../../common/components/entity-actions/ProjectEditButton.js";
import { ProjectViewButton } from "../../../common/components/entity-actions/ProjectViewButton.js";
import { TeamCreateButton } from "../../../common/components/entity-actions/TeamCreateButton.js";
import { TeamViewButton } from "../../../common/components/entity-actions/TeamViewButton.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { UserListItem } from "../../../common/components/entity-list/UserListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { OrganizationCreateModal } from "../../../lobby/components/organization/OrganizationCreateModal.js";
import { OrganizationSummaryModal } from "../../../lobby/components/organization/OrganizationSummaryModal.js";
import { ProjectEditModal } from "../../../lobby/components/project/ProjectEditModal.js";
import { ProjectSummaryModal } from "../../../lobby/components/project/ProjectSummaryModal.js";
import { TeamCreateModal } from "../../../lobby/components/team/TeamCreateModal.js";
import { TeamSummaryModal } from "../../../lobby/components/team/TeamSummaryModal.js";
import type {
  CreateOrganizationRequest,
  CreateTeamRequest,
  GetProjectResponse,
  LobbyOrganization,
  LobbyProject,
  LobbyTeam,
  ProjectMember,
  ProjectManager,
  UpdateProjectRequest,
} from "../../../lobby/contracts/lobby.contracts.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { EntityAssociationModal } from "../components/projects/EntityAssociationModal.js";
import { ProjectDetailsCard } from "../components/projects/ProjectDetailsCard.js";
import { canEditProject } from "../lib/project-edit-permissions.js";
import {
  createProjectIssuesRoute,
  createProjectManagerOrganizationRoute,
  createProjectManagerTeamRoute,
  createProjectManagerUserRoute,
} from "../routes/project-route-paths.js";

interface ProjectManagerProjectPageProps {
  currentUserId?: number;
  currentUserRoles?: string[];
  projectId: number | null;
  token: string;
}

const ASSOCIATE_EXISTING_ORGANIZATION_LABEL = "Associate Existing Organization";
const ASSOCIATE_EXISTING_TEAM_LABEL = "Associate Existing Team";
const DEFAULT_ERROR_MESSAGE = "Unable to load that project right now.";
const DETAIL_SOURCE_LABEL = "Direct";
const DETAILS_TAB_LABEL = "Details";
const LINK_ONLY_VIEW_MODE: EntityListItemViewMode = "link-only-no-action-buttons";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const MISSING_ROUTE_MESSAGE = "Provide a valid projectId to view a project.";
const ORGANIZATIONS_TAB_LABEL = "Organizations";
const ORGANIZATION_SOURCE_LABEL = "Org";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project";
const PROJECT_DELETE_ERROR_MESSAGE = "Unable to delete that project.";
const PROJECT_MANAGERS_HEADING = "Project Managers";
const PROJECT_OWNERS_HEADING = "Project Owners";
const SYSTEM_ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";
const TEAMS_TAB_LABEL = "Teams";
const TEAM_SOURCE_LABEL = "Team";

type ProjectDetailsTabValue = "details" | "organizations" | "teams";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function createAssociationBusyKey(
  projectId: number | null,
  scope: "organization" | "team",
): string {
  return `project:${projectId ?? "unknown"}:associate-${scope}`;
}

function createCreateAssociationBusyKey(
  projectId: number | null,
  scope: "organization" | "team",
): string {
  return `project:${projectId ?? "unknown"}:create-${scope}`;
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

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? "None" : `${projectId}`;
}

function filterAssociableOrganizations(
  availableOrganizations: ReadonlyArray<LobbyOrganization>,
  projectResponse: GetProjectResponse | null,
) {
  return availableOrganizations
    .filter((organization) =>
      !projectResponse?.organizations.some((entry) => entry.id === organization.id)
    )
    .map((organization) => ({ id: organization.id, name: organization.name }));
}

function filterAssociableTeams(
  availableTeams: ReadonlyArray<LobbyTeam>,
  projectResponse: GetProjectResponse | null,
) {
  return availableTeams
    .filter((team) => !projectResponse?.teams.some((entry) => entry.id === team.id))
    .map((team) => ({ id: team.id, name: team.name }));
}

function hasRoleCode(member: ProjectMember, roleCode: string): boolean {
  return member.roleCodes.includes(roleCode);
}

function canDeleteProject(
  currentUserId: number | undefined,
  currentUserRoles: readonly string[] | undefined,
  response: GetProjectResponse | null,
): boolean {
  if (currentUserRoles?.includes(SYSTEM_ADMIN_ROLE_CODE)) {
    return true;
  }

  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.members.some(
    (member) =>
      member.userId === currentUserId &&
      hasRoleCode(member, "GGTC_PROJECTROLE_PROJECT_OWNER"),
  );
}

function renderUsersList<T extends { userId: number; username: string }>(
  users: ReadonlyArray<T>,
  onNavigate: (userId: number) => void,
  renderSupplementaryContent?: (entry: T) => React.ReactNode,
) {
  return (
    <EntityItemList viewMode={LINK_ONLY_VIEW_MODE}>
      {users.map((entry) => (
        <UserListItem
          key={entry.userId}
          onNavigate={() => onNavigate(entry.userId)}
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
  const [activeTab, setActiveTab] = useState<ProjectDetailsTabValue>("details");
  const [availableOrganizations, setAvailableOrganizations] = useState<LobbyOrganization[]>([]);
  const [availableTeams, setAvailableTeams] = useState<LobbyTeam[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAssociateOrganizationModalOpen, setIsAssociateOrganizationModalOpen] = useState(false);
  const [isAssociateTeamModalOpen, setIsAssociateTeamModalOpen] = useState(false);
  const [isCreateAndAssociateOrganizationModalOpen, setIsCreateAndAssociateOrganizationModalOpen] = useState(false);
  const [isCreateAndAssociateTeamModalOpen, setIsCreateAndAssociateTeamModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [organizationSummaryTargetId, setOrganizationSummaryTargetId] = useState<number | null>(null);
  const [projectResponse, setProjectResponse] = useState<GetProjectResponse | null>(null);
  const [projectSummaryRefreshKey, setProjectSummaryRefreshKey] = useState(0);
  const [teamSummaryTargetId, setTeamSummaryTargetId] = useState<number | null>(null);

  const organizationAssociationOptions = useMemo(
    () => filterAssociableOrganizations(availableOrganizations, projectResponse),
    [availableOrganizations, projectResponse],
  );
  const project = projectResponse ? createProjectEntity(projectResponse) : null;
  const projectOwners = projectResponse ? createProjectOwners(projectResponse) : [];
  const teamAssociationOptions = useMemo(
    () => filterAssociableTeams(availableTeams, projectResponse),
    [availableTeams, projectResponse],
  );
  const allowProjectEdit = canEditProject(
    props.currentUserId,
    props.currentUserRoles,
    projectResponse,
  );
  const allowProjectDelete = canDeleteProject(
    props.currentUserId,
    props.currentUserRoles,
    projectResponse,
  );
  const allowProjectAssociations = allowProjectDelete;

  useEffect(() => {
    if (props.projectId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setProjectResponse(null);
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

  function navigateToOrganization(organizationId: number): void {
    navigate(createProjectManagerOrganizationRoute(organizationId));
  }

  function navigateToTeam(teamId: number): void {
    navigate(createProjectManagerTeamRoute(teamId));
  }

  function navigateToUser(userId: number): void {
    navigate(createProjectManagerUserRoute(userId));
  }

  async function loadAssociationCandidates(): Promise<void> {
    try {
      const [teamsResponse, organizationsResponse] = await Promise.all([
        lobbyApi.listTeams(props.token),
        lobbyApi.listOrganizations(props.token),
      ]);
      setAvailableTeams(teamsResponse.teams);
      setAvailableOrganizations(organizationsResponse.organizations);
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    }
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

  async function handleAssociateTeam(teamId: number): Promise<void> {
    if (props.projectId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createAssociationBusyKey(props.projectId, "team");
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.associateProjectTeam(props.token, props.projectId, {
        teamId,
      });
      setProjectResponse((current) => current ? { ...current, teams: response.teams } : current);
    } catch (error) {
      throw new Error(buildErrorMessage(error, "Unable to associate that team."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAssociateOrganization(organizationId: number): Promise<void> {
    if (props.projectId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createAssociationBusyKey(props.projectId, "organization");
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.associateProjectOrganization(props.token, props.projectId, {
        organizationId,
      });
      setProjectResponse((current) => (
        current ? { ...current, organizations: response.organizations } : current
      ));
    } catch (error) {
      throw new Error(buildErrorMessage(error, "Unable to associate that organization."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateAndAssociateTeam(payload: CreateTeamRequest): Promise<LobbyTeam> {
    if (props.projectId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createCreateAssociationBusyKey(props.projectId, "team");
    setBusyKey(actionKey);

    try {
      const response = await lobbyApi.createTeam(props.token, payload);
      await handleAssociateTeam(response.team.id);
      return response.team;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreateAndAssociateOrganization(
    payload: CreateOrganizationRequest,
  ): Promise<LobbyOrganization> {
    if (props.projectId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createCreateAssociationBusyKey(props.projectId, "organization");
    setBusyKey(actionKey);

    try {
      const response = await lobbyApi.createOrganization(props.token, payload);
      await handleAssociateOrganization(response.organization.id);
      return response.organization;
    } finally {
      setBusyKey(null);
    }
  }

  function openAssociateOrganizationModal(): void {
    void loadAssociationCandidates();
    setIsAssociateOrganizationModalOpen(true);
  }

  function openAssociateTeamModal(): void {
    void loadAssociationCandidates();
    setIsAssociateTeamModalOpen(true);
  }

  function renderTeamTabContent() {
    if (!projectResponse) {
      return null;
    }

    return (
      <Stack spacing={1.5}>
        {allowProjectAssociations ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button onClick={openAssociateTeamModal} variant="outlined">
              {ASSOCIATE_EXISTING_TEAM_LABEL}
            </Button>
            <TeamCreateButton
              disabled={busyKey === createCreateAssociationBusyKey(props.projectId, "team")}
              onClick={() => setIsCreateAndAssociateTeamModalOpen(true)}
            />
          </Stack>
        ) : null}
        <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
          {projectResponse.teams.map((team) => (
            <TeamListItem
              actionContent={(
                <TeamViewButton
                  onClick={() => setTeamSummaryTargetId(team.id)}
                />
              )}
              key={team.id}
              onNavigate={() => navigateToTeam(team.id)}
              team={team}
              viewMode={LIST_ITEM_VIEW_MODE}
            />
          ))}
        </EntityItemList>
      </Stack>
    );
  }

  function renderOrganizationTabContent() {
    if (!projectResponse) {
      return null;
    }

    return (
      <Stack spacing={1.5}>
        {allowProjectAssociations ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button onClick={openAssociateOrganizationModal} variant="outlined">
              {ASSOCIATE_EXISTING_ORGANIZATION_LABEL}
            </Button>
            <Button
              disabled={busyKey === createCreateAssociationBusyKey(props.projectId, "organization")}
              onClick={() => setIsCreateAndAssociateOrganizationModalOpen(true)}
              variant="contained"
            >
              Create Organization
            </Button>
          </Stack>
        ) : null}
        <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
          {projectResponse.organizations.map((organization) => (
            <OrganizationListItem
              actionContent={(
                <OrganizationViewButton
                  onClick={() => setOrganizationSummaryTargetId(organization.id)}
                />
              )}
              key={organization.id}
              onNavigate={() => navigateToOrganization(organization.id)}
              organization={organization}
              viewMode={LIST_ITEM_VIEW_MODE}
            />
          ))}
        </EntityItemList>
      </Stack>
    );
  }

  function renderDetailsTabContent() {
    if (!projectResponse) {
      return null;
    }

    return (
      <Stack spacing={2}>
        <ProjectDetailsCard projectResponse={projectResponse} />
        <Stack spacing={1.25}>
          <Typography component="h2" variant="h6">
            {PROJECT_OWNERS_HEADING}
          </Typography>
          {projectOwners.length > 0 ? renderUsersList(projectOwners, navigateToUser) : (
            <Typography color="text.secondary" variant="body2">
              No direct project owners are currently listed.
            </Typography>
          )}
        </Stack>
        <Stack spacing={1.25}>
          <Typography component="h2" variant="h6">
            {PROJECT_MANAGERS_HEADING}
          </Typography>
          {renderUsersList(
            projectResponse.projectManagers,
            navigateToUser,
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
        return renderTeamTabContent();
      case "organizations":
        return renderOrganizationTabContent();
      case "details":
      default:
        return renderDetailsTabContent();
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
      <EntityAssociationModal
        emptyMessage="No additional visible teams are available to associate."
        isBusy={busyKey === createAssociationBusyKey(props.projectId, "team")}
        isOpen={isAssociateTeamModalOpen}
        onAssociate={handleAssociateTeam}
        onClose={() => setIsAssociateTeamModalOpen(false)}
        options={teamAssociationOptions}
        selectLabel="Team"
        submitLabel="Associate Team"
        title="Associate Existing Team"
      />
      <EntityAssociationModal
        emptyMessage="No additional visible organizations are available to associate."
        isBusy={busyKey === createAssociationBusyKey(props.projectId, "organization")}
        isOpen={isAssociateOrganizationModalOpen}
        onAssociate={handleAssociateOrganization}
        onClose={() => setIsAssociateOrganizationModalOpen(false)}
        options={organizationAssociationOptions}
        selectLabel="Organization"
        submitLabel="Associate Organization"
        title="Associate Existing Organization"
      />
      <TeamCreateModal
        isBusy={busyKey === createCreateAssociationBusyKey(props.projectId, "team")}
        isOpen={isCreateAndAssociateTeamModalOpen}
        onClose={() => setIsCreateAndAssociateTeamModalOpen(false)}
        onCreate={handleCreateAndAssociateTeam}
      />
      <OrganizationCreateModal
        isBusy={busyKey === createCreateAssociationBusyKey(props.projectId, "organization")}
        isOpen={isCreateAndAssociateOrganizationModalOpen}
        onClose={() => setIsCreateAndAssociateOrganizationModalOpen(false)}
        onCreate={handleCreateAndAssociateOrganization}
      />
    </Box>
  );
}
