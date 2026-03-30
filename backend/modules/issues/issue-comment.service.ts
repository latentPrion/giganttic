import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { asc, and, count, eq } from "drizzle-orm";

import { issueComments, issues, projects } from "../../../db/index.js";
import {
  hasEffectiveProjectManagerRole,
  hasProjectAccess,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import { DiscussionCommentBodyStorageService } from "../discussion/discussion-comment-body-storage.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { assertProjectAccessibleWithScopedPolicy } from "../scoped-access/scoped-access.policy.js";
import { AttachmentService, toAttachmentSummary } from "./attachment.service.js";
import type {
  CreateIssueCommentRequest,
  IssueCommentResponse,
  UpdateIssueCommentRequest,
} from "./issue-untrusted.contracts.js";

const ISSUE_NOT_FOUND_MESSAGE = "Issue not found";
const PROJECT_NOT_FOUND_MESSAGE = "Project not found";
const PROJECT_VIEW_FORBIDDEN_MESSAGE = "Not permitted to view that project";
const COMMENT_NOT_FOUND_MESSAGE = "Comment not found";
const PARENT_COMMENT_INVALID_MESSAGE =
  "Parent comment must belong to the same issue";
const COMMENT_HAS_REPLIES_MESSAGE =
  "Cannot delete a comment that has replies";
const COMMENT_EDIT_FORBIDDEN_MESSAGE =
  "Not permitted to modify that comment";

type IssueCommentRecord = typeof issueComments.$inferSelect;

@Injectable()
export class IssueCommentService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AttachmentService)
    private readonly attachmentService: AttachmentService,
    @Inject(DiscussionCommentBodyStorageService)
    private readonly commentBodyStorage: DiscussionCommentBodyStorageService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  async listComments(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
  ): Promise<{ comments: IssueCommentResponse[] }> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.assertIssueInProject(projectId, issueId);

    const rows = this.databaseService.db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, issueId))
      .orderBy(asc(issueComments.id))
      .all();

    const comments = await Promise.all(
      rows.map((row) => this.buildCommentResponse(row, projectId)),
    );

    return { comments };
  }

  async getComment(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
    commentId: number,
  ): Promise<{ comment: IssueCommentResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.assertIssueInProject(projectId, issueId);
    const record = this.getCommentRecordOrThrow(issueId, commentId);

    return { comment: await this.buildCommentResponse(record, projectId) };
  }

  async createComment(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
    payload: CreateIssueCommentRequest,
  ): Promise<{ comment: IssueCommentResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.assertIssueInProject(projectId, issueId);
    this.validateParentComment(issueId, payload.parentCommentId ?? null);

    const [created] = this.databaseService.db.insert(issueComments).values({
      createdByUserId: authContext.userId,
      issueId,
      parentCommentId: payload.parentCommentId ?? null,
    }).returning({ id: issueComments.id }).all();

    if (!created) {
      throw new NotFoundException(COMMENT_NOT_FOUND_MESSAGE);
    }

    await this.commentBodyStorage.writeIssueCommentBody(
      projectId,
      issueId,
      created.id,
      payload.body,
    );
    await this.notificationsService.notifyIssueCommentCreated({
      actorUserId: authContext.userId,
      commentId: created.id,
      issueId,
      projectId,
    });
    await this.notificationsService.notifyIssueCommentMentions({
      actorUserId: authContext.userId,
      body: payload.body,
      commentId: created.id,
      issueId,
      projectId,
    });

    const record = this.getCommentRecordOrThrow(issueId, created.id);
    return { comment: await this.buildCommentResponse(record, projectId) };
  }

  async updateComment(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
    commentId: number,
    payload: UpdateIssueCommentRequest,
  ): Promise<{ comment: IssueCommentResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.assertIssueInProject(projectId, issueId);
    const record = this.getCommentRecordOrThrow(issueId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    await this.commentBodyStorage.writeIssueCommentBody(
      projectId,
      issueId,
      commentId,
      payload.body,
    );

    this.databaseService.db.update(issueComments)
      .set({ updatedAt: new Date() })
      .where(eq(issueComments.id, commentId))
      .run();
    await this.notificationsService.notifyIssueCommentMentions({
      actorUserId: authContext.userId,
      body: payload.body,
      commentId,
      issueId,
      projectId,
    });

    const next = this.getCommentRecordOrThrow(issueId, commentId);
    return { comment: await this.buildCommentResponse(next, projectId) };
  }

  async deleteAllCommentBodiesForIssue(
    projectId: number,
    issueId: number,
  ): Promise<void> {
    const rows = this.databaseService.db
      .select({ id: issueComments.id })
      .from(issueComments)
      .where(eq(issueComments.issueId, issueId))
      .all();

    for (const row of rows) {
      await this.commentBodyStorage.deleteIssueCommentBody(
        projectId,
        issueId,
        row.id,
      );
    }
  }

  async deleteComment(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
    commentId: number,
  ): Promise<{ deletedCommentId: number }> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.assertIssueInProject(projectId, issueId);
    const record = this.getCommentRecordOrThrow(issueId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    const replyCountRow = this.databaseService.db
      .select({ value: count() })
      .from(issueComments)
      .where(eq(issueComments.parentCommentId, commentId))
      .get();
    if (Number(replyCountRow?.value ?? 0) > 0) {
      throw new BadRequestException(COMMENT_HAS_REPLIES_MESSAGE);
    }

    this.databaseService.db.delete(issueComments)
      .where(eq(issueComments.id, commentId))
      .run();

    await this.commentBodyStorage.deleteIssueCommentBody(
      projectId,
      issueId,
      commentId,
    );
    await this.attachmentService.removeOrphanAttachmentsAndFiles();

    return { deletedCommentId: commentId };
  }

  async deleteCommentAttachment(
    authContext: AuthContext,
    projectId: number,
    issueId: number,
    commentId: number,
    attachmentId: string,
  ): Promise<{ deletedAttachmentId: string }> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.assertIssueInProject(projectId, issueId);

    const record = this.getCommentRecordOrThrow(issueId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    const deletedAttachmentId = await this.attachmentService.deleteCommentAttachmentLink(
      issueId,
      commentId,
      attachmentId,
    );

    return { deletedAttachmentId };
  }

  private async buildCommentResponse(
    record: IssueCommentRecord,
    projectId: number,
  ): Promise<IssueCommentResponse> {
    const attachmentRows = this.attachmentService.listAttachmentsForComment(
      record.issueId,
      record.id,
    );

    const body = await this.commentBodyStorage.readIssueCommentBody(
      projectId,
      record.issueId,
      record.id,
    );

    return {
      attachments: attachmentRows.map(toAttachmentSummary),
      body,
      createdAt: record.createdAt.toISOString(),
      createdByUserId: record.createdByUserId,
      id: record.id,
      issueId: record.issueId,
      parentCommentId: record.parentCommentId,
      thumbsDownCount: record.thumbsDownCount,
      thumbsUpCount: record.thumbsUpCount,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private validateParentComment(
    issueId: number,
    parentCommentId: number | null,
  ): void {
    if (parentCommentId === null) {
      return;
    }

    const parent = this.databaseService.db.select()
      .from(issueComments)
      .where(eq(issueComments.id, parentCommentId))
      .get();

    if (!parent || parent.issueId !== issueId) {
      throw new BadRequestException(PARENT_COMMENT_INVALID_MESSAGE);
    }
  }

  private getCommentRecordOrThrow(
    issueId: number,
    commentId: number,
  ): IssueCommentRecord {
    const record = this.databaseService.db.select()
      .from(issueComments)
      .where(
        and(eq(issueComments.id, commentId), eq(issueComments.issueId, issueId)),
      )
      .get();
    if (!record) {
      throw new NotFoundException(COMMENT_NOT_FOUND_MESSAGE);
    }

    return record;
  }

  private assertIssueInProject(projectId: number, issueId: number): void {
    const row = this.databaseService.db.select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
      .get();
    if (!row) {
      throw new NotFoundException(ISSUE_NOT_FOUND_MESSAGE);
    }
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

  private assertCanViewProject(
    authContext: AuthContext,
    projectId: number,
  ): void {
    assertProjectAccessibleWithScopedPolicy(
      this.databaseService.db,
      authContext,
      projectId,
      () => {
        if (!hasProjectAccess(this.databaseService.db, projectId, authContext.userId)) {
          throw new ForbiddenException(PROJECT_VIEW_FORBIDDEN_MESSAGE);
        }
      },
    );
  }

  private assertCanEditComment(
    authContext: AuthContext,
    projectId: number,
    record: IssueCommentRecord,
  ): void {
    if (record.createdByUserId === authContext.userId) {
      return;
    }

    assertProjectAccessibleWithScopedPolicy(
      this.databaseService.db,
      authContext,
      projectId,
      () => {
        if (!hasEffectiveProjectManagerRole(
          this.databaseService.db,
          projectId,
          authContext.userId,
        )) {
          throw new ForbiddenException(COMMENT_EDIT_FORBIDDEN_MESSAGE);
        }
      },
    );
  }
}
