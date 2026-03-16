import React, { useEffect, useState } from "react";
import {
  Alert,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { UserListItem } from "../../../common/components/entity-list/UserListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type { GetUserResponse } from "../../../lobby/contracts/lobby.contracts.js";
import {
  createProjectDetailRoute,
  createProjectManagerOrganizationRoute,
  createProjectManagerTeamRoute,
} from "../routes/project-route-paths.js";

interface ProjectManagerUserPageProps {
  token: string;
  userId: number | null;
}

const DEFAULT_ERROR_MESSAGE = "Unable to load that user right now.";
const EMPTY_ORGANIZATIONS_MESSAGE = "This user is not directly associated with any organizations.";
const EMPTY_PROJECTS_MESSAGE = "This user is not directly associated with any projects.";
const EMPTY_TEAMS_MESSAGE = "This user is not directly associated with any teams.";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const MISSING_ROUTE_MESSAGE = "Provide a valid userId to view a user profile.";
const ORGANIZATIONS_HEADING = "Direct Organizations";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "User Profile";
const PROJECTS_HEADING = "Direct Projects";
const TEAMS_HEADING = "Direct Teams";

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
  const [isLoading, setIsLoading] = useState(props.userId !== null);
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
        <UserListItem
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
    </Stack>
  );
}
