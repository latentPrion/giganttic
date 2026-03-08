import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { isApiError } from "../../common/api/api-error.js";
import { lobbyApi } from "../api/lobby-api.js";
import {
  type LobbyOrganization,
  type LobbyProject,
  type LobbyTeam,
} from "../contracts/lobby.contracts.js";
import { LobbySection } from "./LobbySection.js";

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

function buildErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error) && error.responseBody) {
    return error.responseBody;
  }

  return fallback;
}

function createInitialLobbyData(): LobbyData {
  return {
    organizations: [],
    projects: [],
    teams: [],
  };
}

export function UserLobbyPage({ currentUserId, token }: UserLobbyPageProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lobbyData, setLobbyData] = useState<LobbyData>(createInitialLobbyData);
  const [knownLockedOrganizations, setKnownLockedOrganizations] = useState<number[]>([]);
  const [knownLockedTeams, setKnownLockedTeams] = useState<number[]>([]);
  const [isOrganizationsOpen, setIsOrganizationsOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isTeamsOpen, setIsTeamsOpen] = useState(false);

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

  async function deleteProject(projectId: number) {
    const actionKey = `project:${projectId}`;
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      await lobbyApi.deleteProject(token, projectId);
      setLobbyData((previousData) => ({
        ...previousData,
        projects: previousData.projects.filter((project) => project.id !== projectId),
      }));
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to delete that project."));
    } finally {
      setBusyKey(null);
    }
  }

  async function leaveTeam(teamId: number) {
    const actionKey = `team:${teamId}`;
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.getTeam(token, teamId);
      const remainingMembers = response.members.filter((member) => member.userId !== currentUserId);

      if (remainingMembers.length === 0) {
        setKnownLockedTeams((previousIds) =>
          previousIds.includes(teamId) ? previousIds : [...previousIds, teamId]);
        setErrorMessage("You are the only member of that team.");
        return;
      }

      await lobbyApi.replaceTeamMembers(token, teamId, {
        members: remainingMembers.map((member) => ({
          roleCodes: member.roleCodes,
          userId: member.userId,
        })),
      });

      setLobbyData((previousData) => ({
        ...previousData,
        teams: previousData.teams.filter((team) => team.id !== teamId),
      }));
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to leave that team."));
    } finally {
      setBusyKey(null);
    }
  }

  async function leaveOrganization(organizationId: number) {
    const actionKey = `organization:${organizationId}`;
    setBusyKey(actionKey);
    setErrorMessage(null);

    try {
      const response = await lobbyApi.getOrganization(token, organizationId);
      const remainingMembers = response.members.filter((member) => member.userId !== currentUserId);

      if (remainingMembers.length === 0) {
        setKnownLockedOrganizations((previousIds) =>
          previousIds.includes(organizationId)
            ? previousIds
            : [...previousIds, organizationId]);
        setErrorMessage("You are the only member of that organization.");
        return;
      }

      await lobbyApi.replaceOrganizationUsers(token, organizationId, {
        members: remainingMembers.map((member) => ({
          userId: member.userId,
        })),
      });

      setLobbyData((previousData) => ({
        ...previousData,
        organizations: previousData.organizations.filter(
          (organization) => organization.id !== organizationId,
        ),
      }));
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, "Unable to leave that organization."));
    } finally {
      setBusyKey(null);
    }
  }

  const projects = useMemo(() => lobbyData.projects, [lobbyData.projects]);
  const teams = useMemo(() => lobbyData.teams, [lobbyData.teams]);
  const organizations = useMemo(() => lobbyData.organizations, [lobbyData.organizations]);

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
              isOpen={isProjectsOpen}
              onExpandedChange={setIsProjectsOpen}
              title="Projects"
            >
              {projects.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  You do not have any associated projects yet.
                </Typography>
              ) : (
                projects.map((project) => (
                  <Paper elevation={0} key={project.id} sx={{ padding: "1rem 1.25rem" }}>
                    <Stack
                      alignItems={{ sm: "center", xs: "flex-start" }}
                      direction={{ sm: "row", xs: "column" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="h6">{project.name}</Typography>
                        {project.description ? (
                          <Typography color="text.secondary" variant="body2">
                            {project.description}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Button
                        color="error"
                        disabled={busyKey === `project:${project.id}`}
                        onClick={() => void deleteProject(project.id)}
                        variant="outlined"
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Paper>
                ))
              )}
            </LobbySection>
            <LobbySection
              isOpen={isTeamsOpen}
              onExpandedChange={setIsTeamsOpen}
              title="Teams"
            >
              {teams.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  You do not have any associated teams yet.
                </Typography>
              ) : (
                teams.map((team) => (
                  <Paper elevation={0} key={team.id} sx={{ padding: "1rem 1.25rem" }}>
                    <Stack
                      alignItems={{ sm: "center", xs: "flex-start" }}
                      direction={{ sm: "row", xs: "column" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="h6">{team.name}</Typography>
                        {team.description ? (
                          <Typography color="text.secondary" variant="body2">
                            {team.description}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Button
                        disabled={
                          busyKey === `team:${team.id}` || knownLockedTeams.includes(team.id)
                        }
                        onClick={() => void leaveTeam(team.id)}
                        variant="outlined"
                      >
                        Leave
                      </Button>
                    </Stack>
                  </Paper>
                ))
              )}
            </LobbySection>
            <LobbySection
              isOpen={isOrganizationsOpen}
              onExpandedChange={setIsOrganizationsOpen}
              title="Organizations"
            >
              {organizations.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  You do not have any associated organizations yet.
                </Typography>
              ) : (
                organizations.map((organization) => (
                  <Paper
                    elevation={0}
                    key={organization.id}
                    sx={{ padding: "1rem 1.25rem" }}
                  >
                    <Stack
                      alignItems={{ sm: "center", xs: "flex-start" }}
                      direction={{ sm: "row", xs: "column" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="h6">{organization.name}</Typography>
                        {organization.description ? (
                          <Typography color="text.secondary" variant="body2">
                            {organization.description}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Button
                        disabled={
                          busyKey === `organization:${organization.id}`
                          || knownLockedOrganizations.includes(organization.id)
                        }
                        onClick={() => void leaveOrganization(organization.id)}
                        variant="outlined"
                      >
                        Leave
                      </Button>
                    </Stack>
                  </Paper>
                ))
              )}
            </LobbySection>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
