import { requestJson } from "../../../common/api/http-client.js";
import {
  createIssueRequestSchema,
  createIssueResponseSchema,
  deleteIssueResponseSchema,
  getIssueResponseSchema,
  listIssuesResponseSchema,
  updateIssueRequestSchema,
  updateIssueResponseSchema,
  type CreateIssueRequest,
  type CreateIssueResponse,
  type DeleteIssueResponse,
  type GetIssueResponse,
  type ListIssuesResponse,
  type UpdateIssueRequest,
  type UpdateIssueResponse,
} from "../contracts/issue.contracts.js";

function createIssuesPath(projectId: number, issueId?: number): string {
  return issueId === undefined
    ? `/projects/${projectId}/issues`
    : `/projects/${projectId}/issues/${issueId}`;
}

export const issuesApi = {
  async createIssue(
    token: string,
    projectId: number,
    payload: CreateIssueRequest,
  ): Promise<CreateIssueResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: createIssuesPath(projectId),
      requestSchema: createIssueRequestSchema,
      responseSchema: createIssueResponseSchema,
      token,
    });
  },

  async deleteIssue(
    token: string,
    projectId: number,
    issueId: number,
  ): Promise<DeleteIssueResponse> {
    return await requestJson({
      method: "DELETE",
      path: createIssuesPath(projectId, issueId),
      responseSchema: deleteIssueResponseSchema,
      token,
    });
  },

  async getIssue(
    token: string,
    projectId: number,
    issueId: number,
  ): Promise<GetIssueResponse> {
    return await requestJson({
      method: "GET",
      path: createIssuesPath(projectId, issueId),
      responseSchema: getIssueResponseSchema,
      token,
    });
  },

  async listIssues(
    token: string,
    projectId: number,
  ): Promise<ListIssuesResponse> {
    return await requestJson({
      method: "GET",
      path: createIssuesPath(projectId),
      responseSchema: listIssuesResponseSchema,
      token,
    });
  },

  async updateIssue(
    token: string,
    projectId: number,
    issueId: number,
    payload: UpdateIssueRequest,
  ): Promise<UpdateIssueResponse> {
    return await requestJson({
      body: payload,
      method: "PATCH",
      path: createIssuesPath(projectId, issueId),
      requestSchema: updateIssueRequestSchema,
      responseSchema: updateIssueResponseSchema,
      token,
    });
  },
};
