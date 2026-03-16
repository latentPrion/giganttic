import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { OrganizationDeleteButton } from "../../common/components/entity-actions/OrganizationDeleteButton.js";
import { OrganizationCreateButton } from "../../common/components/entity-actions/OrganizationCreateButton.js";
import { OrganizationEditButton } from "../../common/components/entity-actions/OrganizationEditButton.js";
import { OrganizationViewButton } from "../../common/components/entity-actions/OrganizationViewButton.js";
import { ProjectCreateButton } from "../../common/components/entity-actions/ProjectCreateButton.js";
import { ProjectDeleteButton } from "../../common/components/entity-actions/ProjectDeleteButton.js";
import { ProjectEditButton } from "../../common/components/entity-actions/ProjectEditButton.js";
import { ProjectViewButton } from "../../common/components/entity-actions/ProjectViewButton.js";
import { TeamCreateButton } from "../../common/components/entity-actions/TeamCreateButton.js";
import { TeamDeleteButton } from "../../common/components/entity-actions/TeamDeleteButton.js";
import { TeamEditButton } from "../../common/components/entity-actions/TeamEditButton.js";
import { TeamViewButton } from "../../common/components/entity-actions/TeamViewButton.js";
import { OrganizationListItem } from "../../common/components/entity-list/OrganizationListItem.js";
import { EntityItemList } from "../../common/components/entity-list/EntityItemList.js";
import { ProjectListItem } from "../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../common/components/entity-list/TeamListItem.js";
import type { EntityListItemViewMode } from "../../common/components/entity-list/entity-list-item.types.js";
import { getApiErrorMessage } from "../../common/api/api-error.js";
import { lobbyApi } from "../api/lobby-api.js";
import {
  type CreateOrganizationRequest,
  type CreateProjectRequest,
  type CreateTeamRequest,
  type LobbyOrganization,
  type LobbyProject,
  type LobbyTeam,
  type UpdateOrganizationRequest,
  type UpdateProjectRequest,
  type UpdateTeamRequest,
} from "../contracts/lobby.contracts.js";
import { LobbySection } from "./LobbySection.js";
import { OrganizationCreateModal } from "./organization/OrganizationCreateModal.js";
import { OrganizationEditModal } from "./organization/OrganizationEditModal.js";
import { OrganizationSummaryModal } from "./organization/OrganizationSummaryModal.js";
import { ProjectCreateModal } from "./project/ProjectCreateModal.js";
import { ProjectEditModal } from "./project/ProjectEditModal.js";
import { ProjectSummaryModal } from "./project/ProjectSummaryModal.js";
import { TeamCreateModal } from "./team/TeamCreateModal.js";
import { TeamEditModal } from "./team/TeamEditModal.js";
import { TeamSummaryModal } from "./team/TeamSummaryModal.js";

interface UserLobbyPageProps {
  currentUserId: number;
  token: string;
}

interface LobbyData {
  organizations: LobbyOrganization[];
  projects: LobbyProject[];
  teams: LobbyTeam[];
}

const DEFAULT_ERROR_MESSAGE = "Unable to load your lobby right now.";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function createInitialLobbyData(): LobbyData {
  return {
    organizations: [],
    projects: [],
    teams: [],
  };
}

function sortEntitiesById<T extends { id: number }>(entities: T[]): T[] {
  return [...entities].sort((left, right) => left.id - right.id);
}

function upsertEntityById<T extends { id: number }>(entities: T[], entity: T): T[] {
  const remainingEntities = entities.filter((entry) => entry.id !== entity.id);
  return sortEntitiesById([...remainingEntities, entity]);
}

interface ProjectSectionContentProps {
  busyKey: string | null;
  onDeleteProject(projectId: number): void;
  onEditProject(projectId: number): void;
  onOpenSummary(projectId: number): void;
  onProjectNavigate(projectId: number): void;
  projects: LobbyProject[];
  viewMode: EntityListItemViewMode;
}

function ProjectSectionContent(props: ProjectSectionContentProps) {
  if (props.projects.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        You do not have any associated projects yet.
      </Typography>
    );
  }

  return (
    <EntityItemList viewMode={props.viewMode}>
      {props.projects.map((project) => (
        <ProjectListItem
          actionContent={(
            <>
              <ProjectViewButton
                disabled={props.busyKey === `project:${project.id}`}
                onClick={() => props.onOpenSummary(project.id)}
              />
              <ProjectEditButton
                disabled={props.busyKey === `project:${project.id}`}
                onClick={() => props.onEditProject(project.id)}
              />
              <ProjectDeleteButton
                disabled={props.busyKey === `project:${project.id}`}
                onClick={() => props.onDeleteProject(project.id)}
              />
            </>
          )}
          key={project.id}
          onNavigate={() => props.onProjectNavigate(project.id)}
          project={project}
          viewMode={props.viewMode}
        />
      ))}
    </EntityItemList>
  );
}

interface TeamSectionContentProps {
  busyKey: string | null;
  onDeleteTeam(teamId: number): void;
  onEditTeam(teamId: number): void;
  onOpenSummary(teamId: number): void;
  teams: LobbyTeam[];
  viewMode: EntityListItemViewMode;
}

function TeamSectionContent(props: TeamSectionContentProps) {
  if (props.teams.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        You do not have any associated teams yet.
      </Typography>
    );
  }

  return (
    <EntityItemList viewMode={props.viewMode}>
      {props.teams.map((team) => (
        <TeamListItem
          actionContent={(
            <>
              <TeamViewButton
                disabled={props.busyKey === `team:${team.id}`}
                onClick={() => props.onOpenSummary(team.id)}
              />
              <TeamEditButton
                disabled={props.busyKey === `team:${team.id}`}
                onClick={() => props.onEditTeam(team.id)}
              />
              <TeamDeleteButton
                disabled={props.busyKey === `team:${team.id}`}
                onClick={() => props.onDeleteTeam(team.id)}
              />
            </>
          )}
          key={team.id}
          team={team}
          viewMode={props.viewMode}
        />
      ))}
    </EntityItemList>
  );
}

interface OrganizationSectionContentProps {
  busyKey: string | null;
  onDeleteOrganization(organizationId: number): void;
  onEditOrganization(organizationId: number): void;
  onOpenSummary(organizationId: number): void;
  organizations: LobbyOrganization[];
  viewMode: EntityListItemViewMode;
}

function OrganizationSectionContent(props: OrganizationSectionContentProps) {
  if (props.organizations.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        You do not have any associated organizations yet.
      </Typography>
    );
  }

  return (
    <EntityItemList viewMode={props.viewMode}>
      {props.organizations.map((organization) => (
        <OrganizationListItem
          actionContent={(
            <>
              <OrganizationViewButton
                disabled={props.busyKey === `organization:${organization.id}`}
                onClick={() => props.onOpenSummary(organization.id)}
              />
              <OrganizationEditButton
                disabled={props.busyKey === `organization:${organization.id}`}
                onClick={() => props.onEditOrganization(organization.id)}
              />
              <OrganizationDeleteButton
                disabled={props.busyKey === `organization:${organization.id}`}
                onClick={() => props.onDeleteOrganization(organization.id)}
              />
            </>
          )}
          key={organization.id}
          organization={organization}
          viewMode={props.viewMode}
        />
      ))}
    </EntityItemList>
  );
}

export function UserLobbyPage({ token }: UserLobbyPageProps) {
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreateOrganizationModalOpen, setIsCreateOrganizationModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrganizationsOpen, setIsOrganizationsOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isTeamsOpen, setIsTeamsOpen] = useState(false);
  const [lobbyData, setLobbyData] = useState<LobbyData>(createInitialLobbyData);
  const [organizationEditTargetId, setOrganizationEditTargetId] = useState<number | null>(null);
  const [organizationSummaryRefreshKey, setOrganizationSummaryRefreshKey] = useState(0);
  const [organizationSummaryTargetId, setOrganizationSummaryTargetId] = useState<number | null>(
    null,
  );
  const [projectEditTargetId, setProjectEditTargetId] = useState<number | null>(null);
  const [projectSummaryRefreshKey, setProjectSummaryRefreshKey] = useState(0);
  const [projectSummaryTargetId, setProjectSummaryTargetId] = useState<number | null>(null);
  const [teamEditTargetId, setTeamEditTargetId] = useState<number | null>(null);
  const [teamSummaryRefreshKey, setTeamSummaryRefreshKey] = useState(0);
  const [teamSummaryTargetId, setTeamSummaryTargetId] = useState<number | null>(null);

  const loadLobbyData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [projectsResponse, teamsResponse, organizationsResponse] = await Promise.all([
        lobbyApi.listProjects(token),
        lobbyApi.listTeams(token),
        lobbyApi.listOrganizations(token),
      ]);

      setLobbyData({
        organizations: organizationsResponse.organizations,
        projects: projectsResponse.projects,
        teams: teamsResponse.teams,
      });
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadLobbyData();
  }, [loadLobbyData]);

  const selectedProjectForEdit = useMemo(
    () =>
      projectEditTargetId === null
        ? null
        : lobbyData.projects.find((project) => project.id === projectEditTargetId) ?? null,
    [lobbyData.projects, projectEditTargetId],
  );
  const selectedTeamForEdit = useMemo(
    () =>
      teamEditTargetId === null
        ? null
        : lobbyData.teams.find((team) => team.id === teamEditTargetId) ?? null,
    [lobbyData.teams, teamEditTargetId],
  );
  const selectedOrganizationForEdit = useMemo(
    () =>
      organizationEditTargetId === null
        ? null
        : lobbyData.organizations.find(
          (organization) => organization.id === organizationEditTargetId,
        ) ?? null,
    [lobbyData.organizations, organizationEditTargetId],
  );

  function closeOrganizationCreateModal(): void {
    setIsCreateOrganizationModalOpen(false);
  }

  function closeProjectCreateModal(): void {
    setIsCreateProjectModalOpen(false);
  }

  function closeTeamCreateModal(): void {
    setIsCreateTeamModalOpen(false);
  }

  function closeOrganizationEditModal(): void {
    setOrganizationEditTargetId(null);
  }

  function closeProjectEditModal(): void {
    setProjectEditTargetId(null);
  }

  function closeTeamEditModal(): void {
    setTeamEditTargetId(null);
  }

  function closeOrganizationSummaryModal(): void {
    setOrganizationSummaryTargetId(null);
  }

  function closeProjectSummaryModal(): void {
    setProjectSummaryTargetId(null);
  }

  function closeTeamSummaryModal(): void {
    setTeamSummaryTargetId(null);
  }

  function openCreateOrganizationModal(): void {
    setIsCreateOrganizationModalOpen(true);
  }

  function openCreateProjectModal(): void {
    setIsCreateProjectModalOpen(true);
  }

  function openCreateTeamModal(): void {
    setIsCreateTeamModalOpen(true);
  }

  function openOrganizationEditModal(organizationId: number): void {
    setOrganizationEditTargetId(organizationId);
  }

  function openProjectEditModal(projectId: number): void {
    setProjectEditTargetId(projectId);
  }

  function openTeamEditModal(teamId: number): void {
    setTeamEditTargetId(teamId);
  }

  function openOrganizationSummaryModal(organizationId: number): void {
    setOrganizationSummaryTargetId(organizationId);
  }

  function openProjectSummaryModal(projectId: number): void {
    setProjectSummaryTargetId(projectId);
  }

  function navigateToProject(projectId: number): void {
    navigate(`/pm/project?projectId=${projectId}`);
  }

  function openTeamSummaryModal(teamId: number): void {
    setTeamSummaryTargetId(teamId);
  }

  async function createOrganization(
    payload: CreateOrganizationRequest,
  ): Promise<LobbyOrganization> {
    setBusyKey("organization:create");

    try {
      const response = await lobbyApi.createOrganization(token, payload);
      setLobbyData((previousData) => ({
        ...previousData,
        organizations: upsertEntityById(previousData.organizations, response.organization),
      }));
      return response.organization;
    } finally {
      setBusyKey(null);
    }
  }

  async function createProject(payload: CreateProjectRequest): Promise<LobbyProject> {
    setBusyKey("project:create");

    try {
      const response = await lobbyApi.createProject(token, payload);
      setLobbyData((previousData) => ({
        ...previousData,
        projects: upsertEntityById(previousData.projects, response.project),
      }));
      return response.project;
    } finally {
      setBusyKey(null);
    }
  }

  async function createTeam(payload: CreateTeamRequest): Promise<LobbyTeam> {
    setBusyKey("team:create");

    try {
      const response = await lobbyApi.createTeam(token, payload);
      setLobbyData((previousData) => ({
        ...previousData,
        teams: upsertEntityById(previousData.teams, response.team),
      }));
      return response.team;
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteOrganization(organizationId: number): Promise<void> {
    const actionKey = `organization:${organizationId}`;
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      await lobbyApi.deleteOrganization(token, organizationId);
      setLobbyData((previousData) => ({
        ...previousData,
        organizations: previousData.organizations.filter(
          (organization) => organization.id !== organizationId,
        ),
      }));
      if (organizationSummaryTargetId === organizationId) {
        closeOrganizationSummaryModal();
      }
      if (organizationEditTargetId === organizationId) {
        closeOrganizationEditModal();
      }
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to delete that organization."));
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteProject(projectId: number): Promise<void> {
    const actionKey = `project:${projectId}`;
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      await lobbyApi.deleteProject(token, projectId);
      setLobbyData((previousData) => ({
        ...previousData,
        projects: previousData.projects.filter((project) => project.id !== projectId),
      }));
      if (projectSummaryTargetId === projectId) {
        closeProjectSummaryModal();
      }
      if (projectEditTargetId === projectId) {
        closeProjectEditModal();
      }
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to delete that project."));
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteTeam(teamId: number): Promise<void> {
    const actionKey = `team:${teamId}`;
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      await lobbyApi.deleteTeam(token, teamId);
      setLobbyData((previousData) => ({
        ...previousData,
        teams: previousData.teams.filter((team) => team.id !== teamId),
      }));
      if (teamSummaryTargetId === teamId) {
        closeTeamSummaryModal();
      }
      if (teamEditTargetId === teamId) {
        closeTeamEditModal();
      }
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to delete that team."));
    } finally {
      setBusyKey(null);
    }
  }

  async function updateOrganization(
    organizationId: number,
    payload: UpdateOrganizationRequest,
  ): Promise<LobbyOrganization> {
    const actionKey = `organization:${organizationId}`;
    setBusyKey(actionKey);

    try {
      const response = await lobbyApi.updateOrganization(token, organizationId, payload);
      setLobbyData((previousData) => ({
        ...previousData,
        organizations: upsertEntityById(previousData.organizations, response.organization),
      }));
      setOrganizationSummaryRefreshKey((current) => current + 1);
      return response.organization;
    } finally {
      setBusyKey(null);
    }
  }

  async function updateProject(
    projectId: number,
    payload: UpdateProjectRequest,
  ): Promise<LobbyProject> {
    const actionKey = `project:${projectId}`;
    setBusyKey(actionKey);

    try {
      const response = await lobbyApi.updateProject(token, projectId, payload);
      setLobbyData((previousData) => ({
        ...previousData,
        projects: upsertEntityById(previousData.projects, response.project),
      }));
      setProjectSummaryRefreshKey((current) => current + 1);
      return response.project;
    } finally {
      setBusyKey(null);
    }
  }

  async function updateTeam(
    teamId: number,
    payload: UpdateTeamRequest,
  ): Promise<LobbyTeam> {
    const actionKey = `team:${teamId}`;
    setBusyKey(actionKey);

    try {
      const response = await lobbyApi.updateTeam(token, teamId, payload);
      setLobbyData((previousData) => ({
        ...previousData,
        teams: upsertEntityById(previousData.teams, response.team),
      }));
      setTeamSummaryRefreshKey((current) => current + 1);
      return response.team;
    } finally {
      setBusyKey(null);
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
      <Stack spacing={3} sx={{ maxWidth: 1024, width: "100%" }}>
        <Stack spacing={1}>
          <Typography color="primary" variant="overline" sx={{ letterSpacing: "0.14em" }}>
            User Lobby
          </Typography>
          <Typography component="h1" variant="h3">
            Your projects, teams, and organizations
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Manage the workspaces you belong to and take membership actions from a
            single dashboard.
          </Typography>
        </Stack>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {isLoading ? (
          <Paper elevation={0} sx={{ padding: { xs: 1.75, sm: 2.5 } }}>
            <Stack alignItems="center" direction="row" spacing={1.5}>
              <CircularProgress size={22} />
              <Typography>Loading your lobby...</Typography>
            </Stack>
          </Paper>
        ) : (
          <Stack spacing={2.5}>
            <LobbySection
              headerAction={(
                <ProjectCreateButton
                  disabled={busyKey === "project:create"}
                  onClick={openCreateProjectModal}
                />
              )}
              isOpen={isProjectsOpen}
              onExpandedChange={setIsProjectsOpen}
              title="Projects"
            >
              <ProjectSectionContent
                busyKey={busyKey}
                onDeleteProject={(projectId) => void deleteProject(projectId)}
                onEditProject={openProjectEditModal}
                onOpenSummary={openProjectSummaryModal}
                onProjectNavigate={navigateToProject}
                projects={lobbyData.projects}
                viewMode={LIST_ITEM_VIEW_MODE}
              />
            </LobbySection>
            <LobbySection
              headerAction={(
                <TeamCreateButton
                  disabled={busyKey === "team:create"}
                  onClick={openCreateTeamModal}
                />
              )}
              isOpen={isTeamsOpen}
              onExpandedChange={setIsTeamsOpen}
              title="Teams"
            >
              <TeamSectionContent
                busyKey={busyKey}
                onDeleteTeam={(teamId) => void deleteTeam(teamId)}
                onEditTeam={openTeamEditModal}
                onOpenSummary={openTeamSummaryModal}
                teams={lobbyData.teams}
                viewMode={LIST_ITEM_VIEW_MODE}
              />
            </LobbySection>
            <LobbySection
              headerAction={(
                <OrganizationCreateButton
                  disabled={busyKey === "organization:create"}
                  onClick={openCreateOrganizationModal}
                />
              )}
              isOpen={isOrganizationsOpen}
              onExpandedChange={setIsOrganizationsOpen}
              title="Organizations"
            >
              <OrganizationSectionContent
                busyKey={busyKey}
                onDeleteOrganization={(organizationId) => void deleteOrganization(organizationId)}
                onEditOrganization={openOrganizationEditModal}
                onOpenSummary={openOrganizationSummaryModal}
                organizations={lobbyData.organizations}
                viewMode={LIST_ITEM_VIEW_MODE}
              />
            </LobbySection>
          </Stack>
        )}
      </Stack>
      <OrganizationCreateModal
        isBusy={busyKey === "organization:create"}
        isOpen={isCreateOrganizationModalOpen}
        onClose={closeOrganizationCreateModal}
        onCreate={createOrganization}
      />
      <ProjectCreateModal
        isBusy={busyKey === "project:create"}
        isOpen={isCreateProjectModalOpen}
        onClose={closeProjectCreateModal}
        onCreate={createProject}
      />
      <TeamCreateModal
        isBusy={busyKey === "team:create"}
        isOpen={isCreateTeamModalOpen}
        onClose={closeTeamCreateModal}
        onCreate={createTeam}
      />
      <OrganizationEditModal
        isBusy={
          organizationEditTargetId !== null
          && busyKey === `organization:${organizationEditTargetId}`
        }
        isOpen={organizationEditTargetId !== null}
        onClose={closeOrganizationEditModal}
        onUpdate={updateOrganization}
        organization={selectedOrganizationForEdit}
      />
      <ProjectEditModal
        isBusy={projectEditTargetId !== null && busyKey === `project:${projectEditTargetId}`}
        isOpen={projectEditTargetId !== null}
        onClose={closeProjectEditModal}
        onUpdate={updateProject}
        project={selectedProjectForEdit}
      />
      <TeamEditModal
        isBusy={teamEditTargetId !== null && busyKey === `team:${teamEditTargetId}`}
        isOpen={teamEditTargetId !== null}
        onClose={closeTeamEditModal}
        onUpdate={updateTeam}
        team={selectedTeamForEdit}
      />
      <OrganizationSummaryModal
        isOpen={organizationSummaryTargetId !== null}
        onClose={closeOrganizationSummaryModal}
        organizationId={organizationSummaryTargetId}
        refreshKey={organizationSummaryRefreshKey}
        token={token}
      />
      <ProjectSummaryModal
        isOpen={projectSummaryTargetId !== null}
        onClose={closeProjectSummaryModal}
        projectId={projectSummaryTargetId}
        refreshKey={projectSummaryRefreshKey}
        token={token}
      />
      <TeamSummaryModal
        isOpen={teamSummaryTargetId !== null}
        onClose={closeTeamSummaryModal}
        refreshKey={teamSummaryRefreshKey}
        teamId={teamSummaryTargetId}
        token={token}
      />
    </Box>
  );
}
