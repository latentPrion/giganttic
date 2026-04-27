import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, count, eq } from "drizzle-orm";

import { projectGanttCharts, projects, taskComments } from "../../../db/index.js";
import type { DiscussionAttachmentSummary } from "../../../common/discussion/discussion.contracts.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import {
  DiscussionAttachmentService,
  toAttachmentSummary,
} from "../discussion/discussion-attachment.service.js";
import { DiscussionCommentBodyStorageService } from "../discussion/discussion-comment-body-storage.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TasksService } from "./tasks.service.js";
import type {
  CreateTaskCommentRequest,
  TaskCommentResponse,
  UpdateTaskCommentRequest,
} from "./task-untrusted.contracts.js";

const COMMENT_EDIT_FORBIDDEN_MESSAGE =
  "Not permitted to modify that comment";
const COMMENT_HAS_REPLIES_MESSAGE =
  "Cannot delete a comment that has replies";
const COMMENT_NOT_FOUND_MESSAGE = "Comment not found";
const PARENT_COMMENT_INVALID_MESSAGE =
  "Parent comment must belong to the same task";
const PROJECT_NOT_FOUND_MESSAGE = "Project not found";

type TaskCommentRecord = typeof taskComments.$inferSelect;

@Injectable()
export class TaskCommentService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
    @Inject(DiscussionCommentBodyStorageService)
    private readonly commentBodyStorage: DiscussionCommentBodyStorageService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(TasksService)
    private readonly tasksService: TasksService,
  ) {}

  async listComments(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
  ): Promise<{ comments: TaskCommentResponse[] }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.tasksService.validateTaskReadableForCurrentUser(
      authContext,
      projectId,
      chartId,
      taskId,
    );

    const rows = this.databaseService.db
      .select()
      .from(taskComments)
      .where(
        and(
          eq(taskComments.projectGanttChartId, projectGanttChartId),
          eq(taskComments.taskId, taskId),
        ),
      )
      .orderBy(asc(taskComments.id))
      .all();

    const comments = await Promise.all(
      rows.map((row) => this.buildCommentResponse(row)),
    );

    return { comments };
  }

  async getComment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    commentId: number,
  ): Promise<{ comment: TaskCommentResponse }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.tasksService.validateTaskReadableForCurrentUser(
      authContext,
      projectId,
      chartId,
      taskId,
    );

    const record = this.getCommentRecordOrThrow(projectGanttChartId, taskId, commentId);
    return { comment: await this.buildCommentResponse(record) };
  }

  async createComment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    payload: CreateTaskCommentRequest,
  ): Promise<{ comment: TaskCommentResponse }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.validateParentComment(projectGanttChartId, taskId, payload.parentCommentId ?? null);
    this.tasksService.ensureTaskMirrorExistsForReadableTask(
      authContext,
      projectId,
      chartId,
      taskId,
    );

    const [created] = this.databaseService.db.insert(taskComments).values({
      createdByUserId: authContext.userId,
      parentCommentId: payload.parentCommentId ?? null,
      projectGanttChartId,
      taskId,
    }).returning({ id: taskComments.id }).all();

    if (!created) {
      throw new NotFoundException(COMMENT_NOT_FOUND_MESSAGE);
    }

    await this.commentBodyStorage.writeTaskCommentBody(
      projectId,
      taskId,
      created.id,
      payload.body,
    );
    await this.notificationsService.notifyTaskCommentCreated({
      actorUserId: authContext.userId,
      chartId,
      commentId: created.id,
      projectId,
      taskId,
    });
    await this.notificationsService.notifyTaskCommentMentions({
      actorUserId: authContext.userId,
      body: payload.body,
      chartId,
      commentId: created.id,
      projectId,
      taskId,
    });

    const record = this.getCommentRecordOrThrow(projectGanttChartId, taskId, created.id);
    return { comment: await this.buildCommentResponse(record) };
  }

  async updateComment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    commentId: number,
    payload: UpdateTaskCommentRequest,
  ): Promise<{ comment: TaskCommentResponse }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.tasksService.validateTaskReadableForCurrentUser(
      authContext,
      projectId,
      chartId,
      taskId,
    );
    const record = this.getCommentRecordOrThrow(projectGanttChartId, taskId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    await this.commentBodyStorage.writeTaskCommentBody(
      projectId,
      taskId,
      commentId,
      payload.body,
    );

    this.databaseService.db.update(taskComments)
      .set({ updatedAt: new Date() })
      .where(eq(taskComments.id, commentId))
      .run();
    await this.notificationsService.notifyTaskCommentMentions({
      actorUserId: authContext.userId,
      body: payload.body,
      chartId,
      commentId,
      projectId,
      taskId,
    });

    const next = this.getCommentRecordOrThrow(projectGanttChartId, taskId, commentId);
    return { comment: await this.buildCommentResponse(next) };
  }

  async deleteComment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    commentId: number,
  ): Promise<{ deletedCommentId: number }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.tasksService.validateTaskReadableForCurrentUser(
      authContext,
      projectId,
      chartId,
      taskId,
    );
    const record = this.getCommentRecordOrThrow(projectGanttChartId, taskId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    const replyCountRow = this.databaseService.db
      .select({ value: count() })
      .from(taskComments)
      .where(eq(taskComments.parentCommentId, commentId))
      .get();

    if (Number(replyCountRow?.value ?? 0) > 0) {
      throw new BadRequestException(COMMENT_HAS_REPLIES_MESSAGE);
    }

    this.databaseService.db.delete(taskComments)
      .where(eq(taskComments.id, commentId))
      .run();

    await this.commentBodyStorage.deleteTaskCommentBody(projectId, taskId, commentId);
    await this.attachmentService.removeOrphanAttachmentsAndFiles();

    return { deletedCommentId: commentId };
  }

  async deleteCommentAttachment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    commentId: number,
    attachmentId: string,
  ): Promise<{ deletedAttachmentId: string }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.tasksService.validateTaskReadableForCurrentUser(
      authContext,
      projectId,
      chartId,
      taskId,
    );

    const record = this.getCommentRecordOrThrow(projectGanttChartId, taskId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    const deletedAttachmentId = await this.attachmentService.deleteTaskCommentAttachmentLink(
      projectGanttChartId,
      taskId,
      commentId,
      attachmentId,
    );

    return { deletedAttachmentId };
  }

  async uploadCommentAttachment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    commentId: number,
    buffer: Buffer,
    originalFilename: string,
  ): Promise<{ attachment: DiscussionAttachmentSummary }> {
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );
    this.tasksService.validateTaskReadableForCurrentUser(
      authContext,
      projectId,
      chartId,
      taskId,
    );

    const record = this.getCommentRecordOrThrow(projectGanttChartId, taskId, commentId);
    this.assertCanEditComment(authContext, projectId, record);

    const attachment = await this.attachmentService.createAttachmentAndLinkToTaskComment({
      buffer,
      commentId,
      originalFilename,
      projectGanttChartId,
      projectId,
      taskId,
      uploadedByUserId: authContext.userId,
    });

    return { attachment };
  }

  async deleteAllCommentBodiesForTask(
    projectGanttChartId: number,
    taskId: string,
  ): Promise<void> {
    const projectId = this.resolveProjectIdForChart(projectGanttChartId);
    const rows = this.databaseService.db
      .select({ id: taskComments.id })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.projectGanttChartId, projectGanttChartId),
          eq(taskComments.taskId, taskId),
        ),
      )
      .all();

    for (const row of rows) {
      await this.commentBodyStorage.deleteTaskCommentBody(
        projectId,
        taskId,
        row.id,
      );
    }
  }

  private async buildCommentResponse(
    record: TaskCommentRecord,
  ): Promise<TaskCommentResponse> {
    const attachments = this.attachmentService.listAttachmentsForTaskComment(
      record.projectGanttChartId,
      record.taskId,
      record.id,
    );
    const projectId = this.resolveProjectIdForChart(record.projectGanttChartId);
    const body = await this.commentBodyStorage.readTaskCommentBody(
      projectId,
      record.taskId,
      record.id,
    );

    return {
      attachments: attachments.map(toAttachmentSummary),
      body,
      createdAt: record.createdAt.toISOString(),
      createdByUserId: record.createdByUserId,
      id: record.id,
      parentCommentId: record.parentCommentId,
      taskId: record.taskId,
      thumbsDownCount: record.thumbsDownCount,
      thumbsUpCount: record.thumbsUpCount,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private validateParentComment(
    projectGanttChartId: number,
    taskId: string,
    parentCommentId: number | null,
  ): void {
    if (parentCommentId === null) {
      return;
    }

    const parent = this.databaseService.db.select()
      .from(taskComments)
      .where(eq(taskComments.id, parentCommentId))
      .get();

    if (
      !parent
      || parent.projectGanttChartId !== projectGanttChartId
      || parent.taskId !== taskId
    ) {
      throw new BadRequestException(PARENT_COMMENT_INVALID_MESSAGE);
    }
  }

  private getCommentRecordOrThrow(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
  ): TaskCommentRecord {
    const record = this.databaseService.db.select()
      .from(taskComments)
      .where(
        and(
          eq(taskComments.id, commentId),
          eq(taskComments.projectGanttChartId, projectGanttChartId),
          eq(taskComments.taskId, taskId),
        ),
      )
      .get();

    if (!record) {
      throw new NotFoundException(COMMENT_NOT_FOUND_MESSAGE);
    }

    return record;
  }

  private assertCanEditComment(
    authContext: AuthContext,
    projectId: number,
    record: TaskCommentRecord,
  ): void {
    if (record.createdByUserId === authContext.userId) {
      return;
    }

    this.tasksService.assertTaskDiscussionManageableForCurrentUser(
      authContext,
      projectId,
      COMMENT_EDIT_FORBIDDEN_MESSAGE,
    );
  }

  private resolveProjectIdForChart(projectGanttChartId: number): number {
    const row = this.databaseService.db.select({ projectId: projectGanttCharts.projectId })
      .from(projectGanttCharts)
      .where(eq(projectGanttCharts.id, projectGanttChartId))
      .get();
    if (!row) {
      throw new NotFoundException(PROJECT_NOT_FOUND_MESSAGE);
    }
    return row.projectId;
  }
}
