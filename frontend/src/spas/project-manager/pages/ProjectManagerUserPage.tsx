import React, { useEffect, useState } from "react";
import {
  Alert,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { EntityActionButton } from "../../../common/components/entity-actions/EntityActionButton.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { UserListItem } from "../../../common/components/entity-list/UserListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type { GetUserResponse } from "../../../lobby/contracts/lobby.contracts.js";
import { UserPasswordChangeModal } from "../components/users/UserPasswordChangeModal.js";
import {
  createProjectDetailRoute,
  createProjectManagerOrganizationRoute,
  createProjectManagerTeamRoute,
  createProjectManagerUserRoute,
} from "../routes/project-route-paths.js";

interface ProjectManagerUserPageProps {
  currentUserId?: number;
  currentUserRoles?: string[];
  onSelfPasswordRevoked?(): Promise<void>;
  token: string;
  userId: number | null;
}

const CHANGE_PASSWORD_BUTTON_LABEL = "Change Password";
const DEFAULT_ERROR_MESSAGE = "Unable to load that user right now.";
const EMPTY_ORGANIZATIONS_MESSAGE = "This user is not directly associated with any organizations.";
const EMPTY_PROJECTS_MESSAGE = "This user cannot currently see any projects through membership associations.";
const EMPTY_TEAMS_MESSAGE = "This user cannot currently see any teams through membership associations.";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const MISSING_ROUTE_MESSAGE = "Provide a valid userId to view a user profile.";
const ORGANIZATIONS_HEADING = "Direct Organizations";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "User Profile";
const PROJECTS_HEADING = "Visible Projects";
const SYSTEM_ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";
const TEAMS_HEADING = "Visible Teams";
const USER_PASSWORD_CHANGED_MESSAGE = "Password updated.";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function createSelectedUserLabel(userId: number | null): string {
  return userId === null ? "None" : `${userId}`;
}

function renderProjectsSection(
  projects: GetUserResponse["projects"],
  onNavigate: (projectId: number) => void,
) {
  return (
    <Stack spacing={1.25}>
      <Typography component="h2" variant="h6">
        {PROJECTS_HEADING}
      </Typography>
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
          {EMPTY_PROJECTS_MESSAGE}
        </Typography>
      )}
    </Stack>
  );
}

function renderTeamsSection(
  teams: GetUserResponse["teams"],
  onNavigate: (teamId: number) => void,
) {
  return (
    <Stack spacing={1.25}>
      <Typography component="h2" variant="h6">
        {TEAMS_HEADING}
      </Typography>
      {teams.length > 0 ? (
        <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
          {teams.map((team) => (
            <TeamListItem
              key={team.id}
              onNavigate={() => onNavigate(team.id)}
              team={team}
              viewMode={LIST_ITEM_VIEW_MODE}
            />
          ))}
        </EntityItemList>
      ) : (
        <Typography color="text.secondary" variant="body2">
          {EMPTY_TEAMS_MESSAGE}
        </Typography>
      )}
    </Stack>
  );
}

function renderOrganizationsSection(
  organizations: GetUserResponse["organizations"],
  onNavigate: (organizationId: number) => void,
) {
  return (
    <Stack spacing={1.25}>
      <Typography component="h2" variant="h6">
        {ORGANIZATIONS_HEADING}
      </Typography>
      {organizations.length > 0 ? (
        <EntityItemList viewMode={LIST_ITEM_VIEW_MODE}>
          {organizations.map((organization) => (
            <OrganizationListItem
              key={organization.id}
              onNavigate={() => onNavigate(organization.id)}
              organization={organization}
              viewMode={LIST_ITEM_VIEW_MODE}
            />
          ))}
        </EntityItemList>
      ) : (
        <Typography color="text.secondary" variant="body2">
          {EMPTY_ORGANIZATIONS_MESSAGE}
        </Typography>
      )}
    </Stack>
  );
}

export function ProjectManagerUserPage(props: ProjectManagerUserPageProps) {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(props.userId !== null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState<GetUserResponse | null>(null);

  useEffect(() => {
    if (props.userId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setUserResponse(null);
      return;
    }

    let isMounted = true;

    async function loadUser(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await lobbyApi.getUser(props.token, props.userId!);
        if (isMounted) {
          setUserResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
          setUserResponse(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [props.token, props.userId]);

  function navigateToProject(projectId: number): void {
    navigate(createProjectDetailRoute(projectId));
  }

  function navigateToTeam(teamId: number): void {
    navigate(createProjectManagerTeamRoute(teamId));
  }

  function navigateToOrganization(organizationId: number): void {
    navigate(createProjectManagerOrganizationRoute(organizationId));
  }

  function navigateToUser(userId: number): void {
    navigate(createProjectManagerUserRoute(userId));
  }

  function isAdmin(): boolean {
    return props.currentUserRoles?.includes(SYSTEM_ADMIN_ROLE_CODE) ?? false;
  }

  function canChangePassword(): boolean {
    return props.userId !== null && (
      props.currentUserId === props.userId ||
      isAdmin()
    );
  }

  function requiresCurrentPassword(): boolean {
    return props.userId !== null && props.currentUserId === props.userId;
  }

  async function handleChangePassword(payload: {
    currentPassword?: string;
    newPassword: string;
    revokeSessions: boolean;
  }): Promise<void> {
    if (props.userId === null) {
      throw new Error(DEFAULT_ERROR_MESSAGE);
    }

    setIsChangingPassword(true);
    setSuccessMessage(null);

    try {
      await lobbyApi.changeUserPassword(props.token, props.userId, payload);
      if (payload.revokeSessions && props.currentUserId === props.userId) {
        await props.onSelfPasswordRevoked?.();
        return;
      }
      setSuccessMessage(USER_PASSWORD_CHANGED_MESSAGE);
    } finally {
      setIsChangingPassword(false);
    }
  }

  function renderContent() {
    if (props.userId === null) {
      return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading user profile...</Typography>
        </Stack>
      );
    }

    if (!userResponse) {
      return <Alert severity="error">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</Alert>;
    }

    return (
      <Stack spacing={2}>
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
        <UserListItem
          actionContent={canChangePassword() ? (
            <EntityActionButton
              disabled={isChangingPassword}
              label={CHANGE_PASSWORD_BUTTON_LABEL}
              onClick={() => setIsChangePasswordModalOpen(true)}
            />
          ) : undefined}
          onNavigate={() => navigateToUser(userResponse.user.id)}
          user={{
            id: userResponse.user.id,
            username: userResponse.user.username,
          }}
          viewMode={LIST_ITEM_VIEW_MODE}
        >
          <Typography color="text.secondary" variant="body2">
            {userResponse.user.isActive ? "Active user" : "Inactive user"}
          </Typography>
        </UserListItem>
        {renderProjectsSection(userResponse.projects, navigateToProject)}
        {renderTeamsSection(userResponse.teams, navigateToTeam)}
        {renderOrganizationsSection(userResponse.organizations, navigateToOrganization)}
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <div>
        <Typography color="text.secondary" variant="overline">
          {PAGE_OVERLINE}
        </Typography>
        <Typography variant="h4">{PAGE_TITLE}</Typography>
        <Typography color="text.secondary" variant="body2">
          Selected user: {createSelectedUserLabel(props.userId)}
        </Typography>
      </div>
      {renderContent()}
      <UserPasswordChangeModal
        isBusy={isChangingPassword}
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSubmit={handleChangePassword}
        requireCurrentPassword={requiresCurrentPassword()}
      />
    </Stack>
  );
}
