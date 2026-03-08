import { requestJson } from "../../auth/api/http-client.js";
import {
  deleteProjectResponseSchema,
  getOrganizationResponseSchema,
  getTeamResponseSchema,
  listOrganizationsResponseSchema,
  listProjectsResponseSchema,
  listTeamsResponseSchema,
  replaceOrganizationUsersRequestSchema,
  replaceOrganizationUsersResponseSchema,
  replaceTeamMembersRequestSchema,
  replaceTeamMembersResponseSchema,
  type DeleteProjectResponse,
  type GetOrganizationResponse,
  type GetTeamResponse,
  type ListOrganizationsResponse,
  type ListProjectsResponse,
  type ListTeamsResponse,
  type ReplaceOrganizationUsersRequest,
  type ReplaceOrganizationUsersResponse,
  type ReplaceTeamMembersRequest,
  type ReplaceTeamMembersResponse,
} from "../contracts/lobby.contracts.js";

function createProjectPath(projectId?: number): string {
  return projectId === undefined ? "/projects" : `/projects/${projectId}`;
}

function createTeamPath(teamId?: number): string {
  return teamId === undefined ? "/teams" : `/teams/${teamId}`;
}

function createOrganizationPath(organizationId?: number): string {
  return organizationId === undefined
    ? "/organizations"
    : `/organizations/${organizationId}`;
}

export const lobbyApi = {
  async deleteProject(
    token: string,
    projectId: number,
  ): Promise<DeleteProjectResponse> {
    return await requestJson({
      method: "DELETE",
      path: createProjectPath(projectId),
      responseSchema: deleteProjectResponseSchema,
      token,
    });
  },

  async getOrganization(
    token: string,
    organizationId: number,
  ): Promise<GetOrganizationResponse> {
    return await requestJson({
      method: "GET",
      path: createOrganizationPath(organizationId),
      responseSchema: getOrganizationResponseSchema,
      token,
    });
  },

  async getTeam(token: string, teamId: number): Promise<GetTeamResponse> {
    return await requestJson({
      method: "GET",
      path: createTeamPath(teamId),
      responseSchema: getTeamResponseSchema,
      token,
    });
  },

  async listOrganizations(token: string): Promise<ListOrganizationsResponse> {
    return await requestJson({
      method: "GET",
      path: createOrganizationPath(),
      responseSchema: listOrganizationsResponseSchema,
      token,
    });
  },

  async listProjects(token: string): Promise<ListProjectsResponse> {
    return await requestJson({
      method: "GET",
      path: createProjectPath(),
      responseSchema: listProjectsResponseSchema,
      token,
    });
  },

  async listTeams(token: string): Promise<ListTeamsResponse> {
    return await requestJson({
      method: "GET",
      path: createTeamPath(),
      responseSchema: listTeamsResponseSchema,
      token,
    });
  },

  async replaceOrganizationUsers(
    token: string,
    organizationId: number,
    payload: ReplaceOrganizationUsersRequest,
  ): Promise<ReplaceOrganizationUsersResponse> {
    return await requestJson({
      body: payload,
      method: "PUT",
      path: `${createOrganizationPath(organizationId)}/users`,
      requestSchema: replaceOrganizationUsersRequestSchema,
      responseSchema: replaceOrganizationUsersResponseSchema,
      token,
    });
  },

  async replaceTeamMembers(
    token: string,
    teamId: number,
    payload: ReplaceTeamMembersRequest,
  ): Promise<ReplaceTeamMembersResponse> {
    return await requestJson({
      body: payload,
      method: "PUT",
      path: `${createTeamPath(teamId)}/members`,
      requestSchema: replaceTeamMembersRequestSchema,
      responseSchema: replaceTeamMembersResponseSchema,
      token,
    });
  },
};
