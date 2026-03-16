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
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { UserListItem } from "../../../common/components/entity-list/UserListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { ProjectCreateModal } from "../../../lobby/components/project/ProjectCreateModal.js";
import type {
  CreateProjectRequest,
  GetTeamResponse,
  LobbyProject,
  LobbyUser,
  ReplaceTeamMembersRequest,
  ScopedManager,
} from "../../../lobby/contracts/lobby.contracts.js";
import { EntityAssociationModal } from "../components/projects/EntityAssociationModal.js";
import {
  createProjectDetailRoute,
  createProjectManagerUserRoute,
} from "../routes/project-route-paths.js";

interface ProjectManagerTeamPageProps {
  currentUserId?: number;
  currentUserRoles?: string[];
  teamId: number | null;
  token: string;
}

const ADD_MEMBER_USER_LABEL = "Add Member User";
const ASSOCIATE_USER_BUSY_KEY_SUFFIX = "user:associate";
const DEFAULT_ERROR_MESSAGE = "Unable to load that team right now.";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const MISSING_ROUTE_MESSAGE = "Provide a valid teamId to view a team.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Team";
const SYSTEM_ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";
const TEAM_MEMBERS_HEADING = "Members";
const TEAM_MANAGERS_HEADING = "Current Team Managers";
const TEAM_PROJECT_MANAGERS_HEADING = "Current Team Project Managers";
const TEAM_PROJECTS_HEADING = "Current Projects";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function canManageTeam(
  currentUserId: number | undefined,
  currentUserRoles: readonly string[] | undefined,
  response: GetTeamResponse | null,
): boolean {
  if (currentUserRoles?.includes(SYSTEM_ADMIN_ROLE_CODE)) {
    return true;
  }

  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.teamManagers.some((manager) => manager.userId === currentUserId);
}

function createAssociateUserBusyKey(teamId: number | null): string {
  return `team:${teamId ?? "unknown"}:${ASSOCIATE_USER_BUSY_KEY_SUFFIX}`;
}

function createProjectCreateBusyKey(teamId: number | null): string {
  return `team:${teamId ?? "unknown"}:project:create`;
}

function createSelectedTeamLabel(teamId: number | null): string {
  return teamId === null ? "None" : `${teamId}`;
}

function createTeamMembersPayload(
  response: GetTeamResponse,
  userId: number,
): ReplaceTeamMembersRequest {
  return {
    members: [
      ...response.members.map((member) => ({
        roleCodes: member.roleCodes,
        userId: member.userId,
      })),
      {
        roleCodes: [],
        userId,
      },
    ],
  };
}

function filterAssociableUsers(
  availableUsers: ReadonlyArray<LobbyUser>,
  teamResponse: GetTeamResponse | null,
) {
  return availableUsers
    .filter((user) => !teamResponse?.members.some((entry) => entry.userId === user.id))
    .map((user) => ({ id: user.id, name: user.username }));
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
) {
  return (
    <Stack spacing={1.25}>
      {renderSectionHeading(title, actionContent)}
      {users.length > 0 ? (
        <EntityItemList viewMode="link-only-no-action-buttons">
          {users.map((user) => (
            <UserListItem
              key={user.userId}
              onNavigate={() => onNavigate(user.userId)}
              user={{ id: user.userId, username: user.username }}
              viewMode="link-only-no-action-buttons"
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
  projects: GetTeamResponse["projects"],
  onNavigate: (projectId: number) => void,
) {
  return (
    <Stack spacing={1.25}>
      {renderSectionHeading(TEAM_PROJECTS_HEADING)}
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
          This team is not currently linked to any projects.
        </Typography>
      )}
    </Stack>
  );
}

export function ProjectManagerTeamPage(props: ProjectManagerTeamPageProps) {
  const navigate = useNavigate();
  const [availableUsers, setAvailableUsers] = useState<LobbyUser[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.teamId !== null);
  const [teamResponse, setTeamResponse] = useState<GetTeamResponse | null>(null);

  const addableUserOptions = useMemo(
    () => filterAssociableUsers(availableUsers, teamResponse),
    [availableUsers, teamResponse],
  );
  const allowTeamMembershipChanges = canManageTeam(
    props.currentUserId,
    props.currentUserRoles,
    teamResponse,
  );

  useEffect(() => {
    if (props.teamId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setTeamResponse(null);
      return;
    }

    let isMounted = true;

    async function loadTeam(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await lobbyApi.getTeam(props.token, props.teamId);
        if (isMounted) {
          setTeamResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
          setTeamResponse(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTeam();

    return () => {
      isMounted = false;
    };
  }, [props.teamId, props.token]);

  async function loadUserCandidates(): Promise<void> {
    try {
      const response = await lobbyApi.listUsers(props.token);
      setAvailableUsers(response.users);
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    }
  }

  async function handleCreateProject(payload: CreateProjectRequest): Promise<LobbyProject> {
    if (props.teamId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createProjectCreateBusyKey(props.teamId);
    setBusyKey(actionKey);

    let createdProject: LobbyProject | null = null;

    try {
      const createdResponse = await lobbyApi.createProject(props.token, payload);
      createdProject = createdResponse.project;
      await lobbyApi.associateProjectTeam(props.token, createdProject.id, {
        teamId: props.teamId,
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

  async function handleAddUser(userId: number): Promise<void> {
    if (props.teamId === null || !teamResponse) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    const actionKey = createAssociateUserBusyKey(props.teamId);
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.replaceTeamMembers(
        props.token,
        props.teamId,
        createTeamMembersPayload(teamResponse, userId),
      );
      setTeamResponse((current) => current ? { ...current, members: response.members } : current);
    } catch (error) {
      throw new Error(buildErrorMessage(error, "Unable to add that member user."));
    } finally {
      setBusyKey(null);
    }
  }

  function navigateToProject(projectId: number): void {
    navigate(createProjectDetailRoute(projectId));
  }

  function navigateToUser(userId: number): void {
    navigate(createProjectManagerUserRoute(userId));
  }

  function openAddUserModal(): void {
    void loadUserCandidates();
    setIsAddUserModalOpen(true);
  }

  function renderContent() {
    if (props.teamId === null) {
      return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading team...</Typography>
        </Stack>
      );
    }

    if (!teamResponse) {
      return <Alert severity="error">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</Alert>;
    }

    return (
      <Stack spacing={2}>
        <TeamListItem
          actionContent={(
            <ProjectCreateButton
              disabled={busyKey === createProjectCreateBusyKey(props.teamId)}
              onClick={() => setIsCreateProjectModalOpen(true)}
            />
          )}
          team={teamResponse.team}
          viewMode={LIST_ITEM_VIEW_MODE}
        />
        {renderUsersSection(
          TEAM_MEMBERS_HEADING,
          teamResponse.members,
          "No direct team members are currently listed.",
          navigateToUser,
          allowTeamMembershipChanges ? (
            <EntityActionButton
              disabled={busyKey === createAssociateUserBusyKey(props.teamId)}
              label={ADD_MEMBER_USER_LABEL}
              onClick={openAddUserModal}
            />
          ) : undefined,
        )}
        {renderUsersSection(
          TEAM_MANAGERS_HEADING,
          teamResponse.teamManagers as ScopedManager[],
          "No direct team managers are currently listed.",
          navigateToUser,
        )}
        {renderUsersSection(
          TEAM_PROJECT_MANAGERS_HEADING,
          teamResponse.teamProjectManagers as ScopedManager[],
          "No team project managers are currently listed.",
          navigateToUser,
        )}
        {renderProjectsSection(teamResponse.projects, navigateToProject)}
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
            Selected team: {createSelectedTeamLabel(props.teamId)}
          </Typography>
        </Stack>
        {renderContent()}
      </Stack>
      <ProjectCreateModal
        isBusy={busyKey === createProjectCreateBusyKey(props.teamId)}
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onCreate={handleCreateProject}
      />
      <EntityAssociationModal
        emptyMessage="No additional visible users are available to add."
        isBusy={busyKey === createAssociateUserBusyKey(props.teamId)}
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
