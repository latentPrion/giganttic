import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { EntityActionButton } from "../../../common/components/entity-actions/EntityActionButton.js";
import { ProjectCreateButton } from "../../../common/components/entity-actions/ProjectCreateButton.js";
import { TeamDeleteButton } from "../../../common/components/entity-actions/TeamDeleteButton.js";
import { UserDeleteButton } from "../../../common/components/entity-actions/UserDeleteButton.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { UserListItem } from "../../../common/components/entity-list/UserListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { ProjectCreateModal } from "../../../lobby/components/project/ProjectCreateModal.js";
import type {
  CreateProjectRequest,
  GetOrganizationResponse,
  LobbyProject,
  LobbyTeam,
  LobbyUser,
  ReplaceOrganizationUsersRequest,
  ScopedManager,
} from "../../../lobby/contracts/lobby.contracts.js";
import { EntityAssociationModal } from "../components/projects/EntityAssociationModal.js";
import {
  createProjectDetailRoute,
  createProjectManagerTeamRoute,
  createProjectManagerUserRoute,
} from "../routes/project-route-paths.js";

interface ProjectManagerOrganizationPageProps {
  currentUserId?: number;
  currentUserRoles?: string[];
  organizationId: number | null;
  token: string;
}

const ADD_MEMBER_TEAM_LABEL = "Add Member Team";
const ADD_MEMBER_USER_LABEL = "Add Member User";
const ASSOCIATE_TEAM_BUSY_KEY_SUFFIX = "team:associate";
const ASSOCIATE_USER_BUSY_KEY_SUFFIX = "user:associate";
const DEFAULT_ERROR_MESSAGE = "Unable to load that organization right now.";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const MISSING_ROUTE_MESSAGE = "Provide a valid organizationId to view an organization.";
const ORGANIZATION_MANAGERS_HEADING = "Current Organization Managers";
const ORGANIZATION_PROJECT_MANAGERS_HEADING = "Current Organization Project Managers";
const ORGANIZATION_TEAM_MANAGERS_HEADING = "Current Organization Team Managers";
const ORGANIZATION_PROJECTS_HEADING = "Current Projects";
const ORGANIZATION_TEAMS_HEADING = "Current Teams";
const ORGANIZATION_USERS_HEADING = "Members";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Organization";
const REMOVE_MEMBER_LABEL = "Remove";
const SYSTEM_ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function createAssociateTeamBusyKey(organizationId: number | null): string {
  return `organization:${organizationId ?? "unknown"}:${ASSOCIATE_TEAM_BUSY_KEY_SUFFIX}`;
}

function createAssociateUserBusyKey(organizationId: number | null): string {
  return `organization:${organizationId ?? "unknown"}:${ASSOCIATE_USER_BUSY_KEY_SUFFIX}`;
}

function createSelectedOrganizationLabel(organizationId: number | null): string {
  return organizationId === null ? "None" : `${organizationId}`;
}

function createRemoveTeamBusyKey(organizationId: number | null, teamId: number): string {
  return `organization:${organizationId ?? "unknown"}:team:${teamId}:remove`;
}

function createRemoveUserBusyKey(organizationId: number | null, userId: number): string {
  return `organization:${organizationId ?? "unknown"}:user:${userId}:remove`;
}

function filterAssociableTeams(
  availableTeams: ReadonlyArray<LobbyTeam>,
  organizationResponse: GetOrganizationResponse | null,
) {
  return availableTeams
    .filter((team) => !organizationResponse?.teams.some((entry) => entry.id === team.id))
    .map((team) => ({ id: team.id, name: team.name }));
}

function filterAssociableUsers(
  availableUsers: ReadonlyArray<LobbyUser>,
  organizationResponse: GetOrganizationResponse | null,
) {
  return availableUsers
    .filter((user) => !organizationResponse?.members.some((entry) => entry.userId === user.id))
    .map((user) => ({ id: user.id, name: user.username }));
}

function hasSystemAdminRole(currentUserRoles: readonly string[] | undefined): boolean {
  return currentUserRoles?.includes(SYSTEM_ADMIN_ROLE_CODE) ?? false;
}

function canAddOrganizationUsers(
  currentUserId: number | undefined,
  currentUserRoles: readonly string[] | undefined,
  response: GetOrganizationResponse | null,
): boolean {
  if (hasSystemAdminRole(currentUserRoles)) {
    return true;
  }

  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.organizationManagers.some((manager) => manager.userId === currentUserId);
}

function canAddOrganizationTeams(
  currentUserId: number | undefined,
  currentUserRoles: readonly string[] | undefined,
  response: GetOrganizationResponse | null,
): boolean {
  if (hasSystemAdminRole(currentUserRoles)) {
    return true;
  }

  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.organizationManagers.some((manager) => manager.userId === currentUserId) ||
    response.organizationTeamManagers.some((manager) => manager.userId === currentUserId);
}

function createOrganizationUsersPayload(
  response: GetOrganizationResponse,
  userId: number,
): ReplaceOrganizationUsersRequest {
  return {
    members: [
      ...response.members.map((member) => ({ userId: member.userId })),
      { userId },
    ],
  };
}

function createOrganizationUsersRemovalPayload(
  response: GetOrganizationResponse,
  userId: number,
): ReplaceOrganizationUsersRequest {
  return {
    members: response.members
      .filter((member) => member.userId !== userId)
      .map((member) => ({ userId: member.userId })),
  };
}

function renderSectionHeading(title: string, actionContent?: React.ReactNode) {
  return (
    <Stack
      alignItems={{ sm: "center" }}
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      spacing={1}
    >
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      {actionContent ?? null}
    </Stack>
  );
}

function renderUsersSection(
  title: string,
  users: ReadonlyArray<{ userId: number; username: string }>,
  emptyMessage: string,
  onNavigate: (userId: number) => void,
  actionContent?: React.ReactNode,
  renderRowActionContent?: (user: { userId: number; username: string }) => React.ReactNode,
  viewMode: EntityListItemViewMode = "link-only-no-action-buttons",
) {
  return (
    <Stack spacing={1.25}>
      {renderSectionHeading(title, actionContent)}
      {users.length > 0 ? (
        <EntityItemList viewMode={viewMode}>
          {users.map((user) => (
            <UserListItem
              actionContent={renderRowActionContent ? renderRowActionContent(user) : undefined}
              key={user.userId}
              onNavigate={() => onNavigate(user.userId)}
              user={{ id: user.userId, username: user.username }}
              viewMode={viewMode}
            />
          ))}
        </EntityItemList>
      ) : (
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      )}
    </Stack>
  );
}

function renderProjectsSection(
  projects: GetOrganizationResponse["projects"],
  onNavigate: (projectId: number) => void,
) {
  return (
    <Stack spacing={1.25}>
      {renderSectionHeading(ORGANIZATION_PROJECTS_HEADING)}
      {projects.length > 0 ? (
        <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
          {projects.map((project) => (
            <ProjectListItem
              key={project.id}
              onNavigate={() => onNavigate(project.id)}
              project={project}
              viewMode={LIST_ITEM_VIEW_MODE}
            />
          ))}
        </EntityItemList>
      ) : (
        <Typography color="text.secondary" variant="body2">
          This organization is not currently linked to any projects.
        </Typography>
      )}
    </Stack>
  );
}

function renderTeamsSection(
  teams: GetOrganizationResponse["teams"],
  onNavigate: (teamId: number) => void,
  actionContent?: React.ReactNode,
  renderRowActionContent?: (team: GetOrganizationResponse["teams"][number]) => React.ReactNode,
) {
  return (
    <Stack spacing={1.25}>
      {renderSectionHeading(ORGANIZATION_TEAMS_HEADING, actionContent)}
      {teams.length > 0 ? (
        <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
          {teams.map((team) => (
            <TeamListItem
              actionContent={renderRowActionContent ? renderRowActionContent(team) : undefined}
              key={team.id}
              onNavigate={() => onNavigate(team.id)}
              team={team}
              viewMode={LIST_ITEM_VIEW_MODE}
            />
          ))}
        </EntityItemList>
      ) : (
        <Typography color="text.secondary" variant="body2">
          This organization does not currently own any teams.
        </Typography>
      )}
    </Stack>
  );
}

function createProjectCreateBusyKey(organizationId: number | null): string {
  return `organization:${organizationId ?? "unknown"}:project:create`;
}

export function ProjectManagerOrganizationPage(props: ProjectManagerOrganizationPageProps) {
  const navigate = useNavigate();
  const [availableTeams, setAvailableTeams] = useState<LobbyTeam[]>([]);
  const [availableUsers, setAvailableUsers] = useState<LobbyUser[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.organizationId !== null);
  const [organizationResponse, setOrganizationResponse] = useState<GetOrganizationResponse | null>(null);

  const addableTeamOptions = useMemo(
    () => filterAssociableTeams(availableTeams, organizationResponse),
    [availableTeams, organizationResponse],
  );
  const addableUserOptions = useMemo(
    () => filterAssociableUsers(availableUsers, organizationResponse),
    [availableUsers, organizationResponse],
  );
  const allowAddOrganizationTeams = canAddOrganizationTeams(
    props.currentUserId,
    props.currentUserRoles,
    organizationResponse,
  );
  const allowAddOrganizationUsers = canAddOrganizationUsers(
    props.currentUserId,
    props.currentUserRoles,
    organizationResponse,
  );

  useEffect(() => {
    if (props.organizationId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setOrganizationResponse(null);
      return;
    }

    const organizationId = props.organizationId;
    let isMounted = true;

    async function loadOrganization(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await lobbyApi.getOrganization(props.token, organizationId);
        if (isMounted) {
          setOrganizationResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
          setOrganizationResponse(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrganization();

    return () => {
      isMounted = false;
    };
  }, [props.organizationId, props.token]);

  async function loadOrganizationAssociationCandidates(): Promise<void> {
    try {
      const [teamsResponse, usersResponse] = await Promise.all([
        lobbyApi.listTeams(props.token),
        lobbyApi.listUsers(props.token),
      ]);
      setAvailableTeams(teamsResponse.teams);
      setAvailableUsers(usersResponse.users);
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    }
  }

  async function handleCreateProject(payload: CreateProjectRequest): Promise<LobbyProject> {
    if (props.organizationId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createProjectCreateBusyKey(props.organizationId);
    setBusyKey(actionKey);

    let createdProject: LobbyProject | null = null;

    try {
      const createdResponse = await lobbyApi.createProject(props.token, payload);
      createdProject = createdResponse.project;
      await lobbyApi.associateProjectOrganization(props.token, createdProject.id, {
        organizationId: props.organizationId,
      });
      navigate(createProjectDetailRoute(createdProject.id));
      return createdProject;
    } catch (error) {
      if (createdProject !== null) {
        try {
          await lobbyApi.deleteProject(props.token, createdProject.id);
        } catch {
          // Best-effort cleanup only.
        }
      }
      throw error;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddTeam(teamId: number): Promise<void> {
    if (props.organizationId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createAssociateTeamBusyKey(props.organizationId);
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.assignOrganizationTeam(props.token, props.organizationId, {
        teamId,
      });
      setOrganizationResponse((current) => current ? { ...current, teams: response.teams } : current);
    } catch (error) {
      throw new Error(buildErrorMessage(error, "Unable to add that member team."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddUser(userId: number): Promise<void> {
    if (props.organizationId === null || !organizationResponse) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createAssociateUserBusyKey(props.organizationId);
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.replaceOrganizationUsers(
        props.token,
        props.organizationId,
        createOrganizationUsersPayload(organizationResponse, userId),
      );
      setOrganizationResponse((current) => current ? { ...current, members: response.members } : current);
    } catch (error) {
      throw new Error(buildErrorMessage(error, "Unable to add that member user."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemoveUser(userId: number): Promise<void> {
    if (props.organizationId === null || !organizationResponse) {
      return;
    }

    const actionKey = createRemoveUserBusyKey(props.organizationId, userId);
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.replaceOrganizationUsers(
        props.token,
        props.organizationId,
        createOrganizationUsersRemovalPayload(organizationResponse, userId),
      );
      setOrganizationResponse((current) => current ? { ...current, members: response.members } : current);
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to remove that member user."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemoveTeam(teamId: number): Promise<void> {
    if (props.organizationId === null) {
      return;
    }

    const actionKey = createRemoveTeamBusyKey(props.organizationId, teamId);
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.unassignOrganizationTeam(
        props.token,
        props.organizationId,
        teamId,
      );
      setOrganizationResponse((current) => current ? { ...current, teams: response.teams } : current);
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to remove that member team."));
    } finally {
      setBusyKey(null);
    }
  }

  function navigateToProject(projectId: number): void {
    navigate(createProjectDetailRoute(projectId));
  }

  function navigateToTeam(teamId: number): void {
    navigate(createProjectManagerTeamRoute(teamId));
  }

  function navigateToUser(userId: number): void {
    navigate(createProjectManagerUserRoute(userId));
  }

  function openAddTeamModal(): void {
    void loadOrganizationAssociationCandidates();
    setIsAddTeamModalOpen(true);
  }

  function openAddUserModal(): void {
    void loadOrganizationAssociationCandidates();
    setIsAddUserModalOpen(true);
  }

  function renderContent() {
    if (props.organizationId === null) {
      return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading organization...</Typography>
        </Stack>
      );
    }

    if (!organizationResponse) {
      return <Alert severity="error">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</Alert>;
    }

    return (
      <Stack spacing={2}>
        <OrganizationListItem
          actionContent={(
            <ProjectCreateButton
              disabled={busyKey === createProjectCreateBusyKey(props.organizationId)}
              onClick={() => setIsCreateProjectModalOpen(true)}
            />
          )}
          organization={organizationResponse.organization}
          viewMode={LIST_ITEM_VIEW_MODE}
        />
        {renderUsersSection(
          ORGANIZATION_USERS_HEADING,
          organizationResponse.members,
          "No direct organization members are currently listed.",
          navigateToUser,
          allowAddOrganizationUsers ? (
            <EntityActionButton
              disabled={busyKey === createAssociateUserBusyKey(props.organizationId)}
              label={ADD_MEMBER_USER_LABEL}
              onClick={openAddUserModal}
            />
          ) : undefined,
          allowAddOrganizationUsers ? (user) => (
            <UserDeleteButton
              disabled={busyKey === createRemoveUserBusyKey(props.organizationId, user.userId)}
              label={REMOVE_MEMBER_LABEL}
              onClick={() => void handleRemoveUser(user.userId)}
            />
          ) : undefined,
          LIST_ITEM_VIEW_MODE,
        )}
        {renderUsersSection(
          ORGANIZATION_MANAGERS_HEADING,
          organizationResponse.organizationManagers as ScopedManager[],
          "No direct organization managers are currently listed.",
          navigateToUser,
        )}
        {renderUsersSection(
          ORGANIZATION_PROJECT_MANAGERS_HEADING,
          organizationResponse.organizationProjectManagers as ScopedManager[],
          "No organization project managers are currently listed.",
          navigateToUser,
        )}
        {renderUsersSection(
          ORGANIZATION_TEAM_MANAGERS_HEADING,
          organizationResponse.organizationTeamManagers as ScopedManager[],
          "No organization team managers are currently listed.",
          navigateToUser,
        )}
        {renderProjectsSection(organizationResponse.projects, navigateToProject)}
        {renderTeamsSection(
          organizationResponse.teams,
          navigateToTeam,
          allowAddOrganizationTeams ? (
            <EntityActionButton
              disabled={busyKey === createAssociateTeamBusyKey(props.organizationId)}
              label={ADD_MEMBER_TEAM_LABEL}
              onClick={openAddTeamModal}
            />
          ) : undefined,
          allowAddOrganizationTeams ? (team) => (
            <TeamDeleteButton
              disabled={busyKey === createRemoveTeamBusyKey(props.organizationId, team.id)}
              label={REMOVE_MEMBER_LABEL}
              onClick={() => void handleRemoveTeam(team.id)}
            />
          ) : undefined,
        )}
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
      <Stack spacing={2.5} sx={{ flex: 1, maxWidth: 1360, width: "100%" }}>
        <Stack spacing={0.75}>
          <Typography color="primary" variant="overline" sx={{ letterSpacing: "0.14em" }}>
            {PAGE_OVERLINE}
          </Typography>
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected organization: {createSelectedOrganizationLabel(props.organizationId)}
          </Typography>
        </Stack>
        {renderContent()}
      </Stack>
      <ProjectCreateModal
        isBusy={busyKey === createProjectCreateBusyKey(props.organizationId)}
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onCreate={handleCreateProject}
      />
      <EntityAssociationModal
        emptyMessage="No additional visible teams are available to add."
        isBusy={busyKey === createAssociateTeamBusyKey(props.organizationId)}
        isOpen={isAddTeamModalOpen}
        onAssociate={handleAddTeam}
        onClose={() => setIsAddTeamModalOpen(false)}
        options={addableTeamOptions}
        selectLabel="Team"
        submitLabel="Add Member Team"
        title="Add Member Team"
      />
      <EntityAssociationModal
        emptyMessage="No additional visible users are available to add."
        isBusy={busyKey === createAssociateUserBusyKey(props.organizationId)}
        isOpen={isAddUserModalOpen}
        onAssociate={handleAddUser}
        onClose={() => setIsAddUserModalOpen(false)}
        options={addableUserOptions}
        selectLabel="User"
        submitLabel="Add Member User"
        title="Add Member User"
      />
    </Box>
  );
}
