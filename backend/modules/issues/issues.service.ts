import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";

import {
  issues,
  issueStatusCodes,
  projects,
} from "../../../db/index.js";
import {
  hasEffectiveProjectManagerRole,
  hasProjectAccess,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import type {
  CreateIssueRequest,
  DeleteIssueResponse,
  GetIssueResponse,
  IssueResponse,
  ListIssuesResponse,
  UpdateIssueRequest,
} from "./issues.contracts.js";


const CLOSED_ISSUE_REASON_REQUIRED_MESSAGE =
  "Closed issues require a closed reason";
const CLOSED_REASON_ONLY_FOR_CLOSED_ISSUE_MESSAGE =
  "Closed reason fields are only valid for closed issues";
const ISSUE_DELETE_FORBIDDEN_MESSAGE = "Not permitted to delete that issue";
const ISSUE_MANAGE_FORBIDDEN_MESSAGE = "Not permitted to manage that issue";
const ISSUE_NOT_FOUND_MESSAGE = "Issue not found";
const ISSUE_VIEW_FORBIDDEN_MESSAGE = "Not permitted to view that issue";
const PROJECT_NOT_FOUND_MESSAGE = "Project not found";
const PROJECT_VIEW_FORBIDDEN_MESSAGE = "Not permitted to view that project";

type IssueRecord = typeof issues.$inferSelect;

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return value.trim();
}

function toIssueResponse(issue: IssueRecord): IssueResponse {
  return {
    closedAt: issue.closedAt?.toISOString() ?? null,
    closedReason: issue.closedReason as IssueResponse["closedReason"],
    closedReasonDescription: issue.closedReasonDescription ?? null,
    createdAt: issue.createdAt.toISOString(),
    description: issue.description ?? null,
    id: issue.id,
    journal: issue.journal ?? null,
    name: issue.name,
    openedAt: issue.openedAt.toISOString(),
    priority: issue.priority,
    progressPercentage: issue.progressPercentage,
    projectId: issue.projectId,
    status: issue.status as IssueResponse["status"],
    updatedAt: issue.updatedAt.toISOString(),
  };
}

function createIssueInsertValues(
  projectId: number,
  payload: CreateIssueRequest,
  now: Date,
) {
  const normalizedState = createIssueStateValues(payload.status, payload.closedReason, payload.closedReasonDescription, now);
  return {
    closedAt: normalizedState.closedAt,
    closedReason: normalizedState.closedReason,
    closedReasonDescription: normalizedState.closedReasonDescription,
    description: normalizeNullableText(payload.description) ?? null,
    journal: normalizeNullableText(payload.journal) ?? null,
    name: payload.name.trim(),
    openedAt: now,
    priority: payload.priority ?? 0,
    progressPercentage: payload.progressPercentage ?? 0,
    projectId,
    status: normalizedState.status,
  };
}

function createIssueUpdateValues(payload: UpdateIssueRequest, currentIssue: IssueRecord, now: Date) {
  const nextStatus = payload.status ?? currentIssue.status;
  const nextClosedReason = payload.closedReason === undefined
    ? currentIssue.closedReason
    : payload.closedReason;
  const nextClosedReasonDescription = payload.closedReasonDescription === undefined
    ? currentIssue.closedReasonDescription
    : normalizeNullableText(payload.closedReasonDescription) ?? null;
  const normalizedState = createIssueStateValues(
    nextStatus,
    nextClosedReason,
    nextClosedReasonDescription,
    now,
  );

  return {
    closedAt: normalizedState.closedAt,
    closedReason: normalizedState.closedReason,
    closedReasonDescription: normalizedState.closedReasonDescription,
    description: payload.description === undefined
      ? undefined
      : normalizeNullableText(payload.description) ?? null,
    journal: payload.journal === undefined
      ? undefined
      : normalizeNullableText(payload.journal) ?? null,
    name: payload.name?.trim(),
    priority: payload.priority,
    progressPercentage: payload.progressPercentage,
    status: normalizedState.status,
    updatedAt: now,
  };
}

function createIssueStateValues(
  status: string | undefined,
  closedReason: string | null | undefined,
  closedReasonDescription: string | null | undefined,
  now: Date,
) {
  const normalizedStatus = status ?? issueStatusCodes.open;
  const normalizedClosedReasonDescription = normalizeNullableText(
    closedReasonDescription,
  ) ?? null;

  if (normalizedStatus === issueStatusCodes.closed) {
    if (!closedReason) {
      throw new BadRequestException(CLOSED_ISSUE_REASON_REQUIRED_MESSAGE);
    }

    return {
      closedAt: now,
      closedReason,
      closedReasonDescription: normalizedClosedReasonDescription,
      status: normalizedStatus,
    };
  }

  if (closedReason !== null && closedReason !== undefined) {
    throw new BadRequestException(CLOSED_REASON_ONLY_FOR_CLOSED_ISSUE_MESSAGE);
  }
  if (normalizedClosedReasonDescription !== null) {
    throw new BadRequestException(CLOSED_REASON_ONLY_FOR_CLOSED_ISSUE_MESSAGE);
  }

  return {
    closedAt: null,
    closedReason: null,
    closedReasonDescription: null,
    status: normalizedStatus,
  };
}

@Injectable()
export class IssuesService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async createIssue(
    authContext: AuthContext,
    projectId: number,
    payload: CreateIssueRequest,
  ): Promise<{ issue: IssueResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanManageIssues(authContext, projectId);

    const now = new Date();
    const [createdIssue] = this.databaseService.db.insert(issues)
      .values(createIssueInsertValues(projectId, payload, now))
      .returning({ id: issues.id })
      .all();
    await this.databaseService.persist();

    return { issue: this.getIssueRecordByIdOrThrow(projectId, createdIssue.id) };
  }

  listIssues(authContext: AuthContext, projectId: number): ListIssuesResponse {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);

    return {
      issues: this.databaseService.db
        .select()
        .from(issues)
        .where(eq(issues.projectId, projectId))
        .orderBy(asc(issues.id))
        .all()
        .map(toIssueResponse),
    };
  }

  getIssue(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
  ): GetIssueResponse {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);

    return { issue: this.getIssueRecordByIdOrThrow(projectId, issueId) };
  }

  async updateIssue(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
    payload: UpdateIssueRequest,
  ): Promise<{ issue: IssueResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanManageIssues(authContext, projectId);
    const currentIssue = this.getIssueEntityByIdOrThrow(projectId, issueId);

    this.databaseService.db.update(issues)
      .set(createIssueUpdateValues(payload, currentIssue, new Date()))
      .where(eq(issues.id, issueId))
      .run();
    await this.databaseService.persist();

    return { issue: this.getIssueRecordByIdOrThrow(projectId, issueId) };
  }

  async deleteIssue(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
  ): Promise<DeleteIssueResponse> {
    this.assertProjectExists(projectId);
    this.assertCanManageIssues(authContext, projectId);
    this.getIssueEntityByIdOrThrow(projectId, issueId);

    this.databaseService.db.delete(issues)
      .where(eq(issues.id, issueId))
      .run();
    await this.databaseService.persist();

    return { deletedIssueId: issueId };
  }

  private assertProjectExists(projectId: number): void {
    const project = this.databaseService.db.select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (!project) {
      throw new NotFoundException(PROJECT_NOT_FOUND_MESSAGE);
    }
  }

  private assertCanManageIssues(authContext: AuthContext, projectId: number): void {
    if (hasEffectiveProjectManagerRole(this.databaseService.db, projectId, authContext.userId)) {
      return;
    }
    throw new ForbiddenException(ISSUE_MANAGE_FORBIDDEN_MESSAGE);
  }

  private assertCanViewProject(authContext: AuthContext, projectId: number): void {
    if (hasProjectAccess(this.databaseService.db, projectId, authContext.userId)) {
      return;
    }
    throw new ForbiddenException(PROJECT_VIEW_FORBIDDEN_MESSAGE);
  }

  private getIssueEntityByIdOrThrow(projectId: number, issueId: number): IssueRecord {
    const issue = this.databaseService.db.select()
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
      .get();
    if (!issue) {
      throw new NotFoundException(ISSUE_NOT_FOUND_MESSAGE);
    }
    return issue;
  }

  private getIssueRecordByIdOrThrow(projectId: number, issueId: number): IssueResponse {
    return toIssueResponse(this.getIssueEntityByIdOrThrow(projectId, issueId));
  }
}
