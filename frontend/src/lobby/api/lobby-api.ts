import { requestJson } from "../../common/api/http-client.js";
import {
  createOrganizationRequestSchema,
  createOrganizationResponseSchema,
  createProjectRequestSchema,
  createProjectResponseSchema,
  createTeamRequestSchema,
  createTeamResponseSchema,
  deleteOrganizationResponseSchema,
  deleteProjectResponseSchema,
  deleteTeamResponseSchema,
  getOrganizationResponseSchema,
  getProjectResponseSchema,
  getTeamResponseSchema,
  getUserResponseSchema,
  assignOrganizationTeamRequestSchema,
  listUsersResponseSchema,
  listOrganizationsResponseSchema,
  listProjectsResponseSchema,
  listTeamsResponseSchema,
  projectOrganizationAssociationRequestSchema,
  projectTeamAssociationRequestSchema,
  replaceOrganizationUsersRequestSchema,
  replaceOrganizationUsersResponseSchema,
  replaceTeamMembersRequestSchema,
  replaceTeamMembersResponseSchema,
  updateOrganizationTeamsResponseSchema,
  updateProjectOrganizationsResponseSchema,
  updateProjectTeamsResponseSchema,
  updateOrganizationRequestSchema,
  updateOrganizationResponseSchema,
  updateProjectRequestSchema,
  updateProjectResponseSchema,
  updateTeamRequestSchema,
  updateTeamResponseSchema,
  type CreateOrganizationRequest,
  type CreateOrganizationResponse,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type CreateTeamRequest,
  type CreateTeamResponse,
  type DeleteOrganizationResponse,
  type DeleteProjectResponse,
  type DeleteTeamResponse,
  type GetOrganizationResponse,
  type GetProjectResponse,
  type GetTeamResponse,
  type GetUserResponse,
  type AssignOrganizationTeamRequest,
  type ListUsersResponse,
  type ListOrganizationsResponse,
  type ListProjectsResponse,
  type ListTeamsResponse,
  type ProjectOrganizationAssociationRequest,
  type ProjectTeamAssociationRequest,
  type ReplaceOrganizationUsersRequest,
  type ReplaceOrganizationUsersResponse,
  type ReplaceTeamMembersRequest,
  type ReplaceTeamMembersResponse,
  type UpdateProjectOrganizationsResponse,
  type UpdateProjectTeamsResponse,
  type UpdateOrganizationTeamsResponse,
  type UpdateOrganizationRequest,
  type UpdateOrganizationResponse,
  type UpdateProjectRequest,
  type UpdateProjectResponse,
  type UpdateTeamRequest,
  type UpdateTeamResponse,
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

function createUserPath(userId?: number): string {
  return userId === undefined ? "/users" : `/users/${userId}`;
}

export const lobbyApi = {
  async createOrganization(
    token: string,
    payload: CreateOrganizationRequest,
  ): Promise<CreateOrganizationResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: createOrganizationPath(),
      requestSchema: createOrganizationRequestSchema,
      responseSchema: createOrganizationResponseSchema,
      token,
    });
  },

  async createProject(
    token: string,
    payload: CreateProjectRequest,
  ): Promise<CreateProjectResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: createProjectPath(),
      requestSchema: createProjectRequestSchema,
      responseSchema: createProjectResponseSchema,
      token,
    });
  },

  async createTeam(
    token: string,
    payload: CreateTeamRequest,
  ): Promise<CreateTeamResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: createTeamPath(),
      requestSchema: createTeamRequestSchema,
      responseSchema: createTeamResponseSchema,
      token,
    });
  },

  async deleteOrganization(
    token: string,
    organizationId: number,
  ): Promise<DeleteOrganizationResponse> {
    return await requestJson({
      method: "DELETE",
      path: createOrganizationPath(organizationId),
      responseSchema: deleteOrganizationResponseSchema,
      token,
    });
  },

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

  async deleteTeam(token: string, teamId: number): Promise<DeleteTeamResponse> {
    return await requestJson({
      method: "DELETE",
      path: createTeamPath(teamId),
      responseSchema: deleteTeamResponseSchema,
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

  async getProject(token: string, projectId: number): Promise<GetProjectResponse> {
    return await requestJson({
      method: "GET",
      path: createProjectPath(projectId),
      responseSchema: getProjectResponseSchema,
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

  async getUser(token: string, userId: number): Promise<GetUserResponse> {
    return await requestJson({
      method: "GET",
      path: createUserPath(userId),
      responseSchema: getUserResponseSchema,
      token,
    });
  },

  async listUsers(token: string): Promise<ListUsersResponse> {
    return await requestJson({
      method: "GET",
      path: createUserPath(),
      responseSchema: listUsersResponseSchema,
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

  async updateProject(
    token: string,
    projectId: number,
    payload: UpdateProjectRequest,
  ): Promise<UpdateProjectResponse> {
    return await requestJson({
      body: payload,
      method: "PATCH",
      path: createProjectPath(projectId),
      requestSchema: updateProjectRequestSchema,
      responseSchema: updateProjectResponseSchema,
      token,
    });
  },

  async updateOrganization(
    token: string,
    organizationId: number,
    payload: UpdateOrganizationRequest,
  ): Promise<UpdateOrganizationResponse> {
    return await requestJson({
      body: payload,
      method: "PATCH",
      path: createOrganizationPath(organizationId),
      requestSchema: updateOrganizationRequestSchema,
      responseSchema: updateOrganizationResponseSchema,
      token,
    });
  },

  async updateTeam(
    token: string,
    teamId: number,
    payload: UpdateTeamRequest,
  ): Promise<UpdateTeamResponse> {
    return await requestJson({
      body: payload,
      method: "PATCH",
      path: createTeamPath(teamId),
      requestSchema: updateTeamRequestSchema,
      responseSchema: updateTeamResponseSchema,
      token,
    });
  },

  async associateProjectOrganization(
    token: string,
    projectId: number,
    payload: ProjectOrganizationAssociationRequest,
  ): Promise<UpdateProjectOrganizationsResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: `${createProjectPath(projectId)}/organizations`,
      requestSchema: projectOrganizationAssociationRequestSchema,
      responseSchema: updateProjectOrganizationsResponseSchema,
      token,
    });
  },

  async associateProjectTeam(
    token: string,
    projectId: number,
    payload: ProjectTeamAssociationRequest,
  ): Promise<UpdateProjectTeamsResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: `${createProjectPath(projectId)}/teams`,
      requestSchema: projectTeamAssociationRequestSchema,
      responseSchema: updateProjectTeamsResponseSchema,
      token,
    });
  },

  async assignOrganizationTeam(
    token: string,
    organizationId: number,
    payload: AssignOrganizationTeamRequest,
  ): Promise<UpdateOrganizationTeamsResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: `${createOrganizationPath(organizationId)}/teams`,
      requestSchema: assignOrganizationTeamRequestSchema,
      responseSchema: updateOrganizationTeamsResponseSchema,
      token,
    });
  },

  async unassignOrganizationTeam(
    token: string,
    organizationId: number,
    teamId: number,
  ): Promise<UpdateOrganizationTeamsResponse> {
    return await requestJson({
      method: "DELETE",
      path: `${createOrganizationPath(organizationId)}/teams/${teamId}`,
      responseSchema: updateOrganizationTeamsResponseSchema,
      token,
    });
  },
};
