import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";

import { projectGanttCharts, projects } from "../../../db/index.js";
import type { DiscussionAttachmentSummary } from "../../../common/discussion/discussion.contracts.js";
import {
  hasEffectiveProjectManagerRole,
  hasProjectAccess,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import {
  DiscussionAttachmentService,
} from "../discussion/discussion-attachment.service.js";
import { DiscussionJournalStorageService } from "../discussion/discussion-journal-storage.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { assertProjectAccessibleWithScopedPolicy } from "../scoped-access/scoped-access.policy.js";
import { TaskMirrorService } from "./task-mirror.service.js";

const PROJECT_NOT_FOUND_MESSAGE = "Project not found";
const PROJECT_VIEW_FORBIDDEN_MESSAGE = "Not permitted to view that project";
const TASK_DISCUSSION_MANAGE_FORBIDDEN_MESSAGE =
  "Not permitted to manage task discussions";

@Injectable()
export class TasksService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(TaskMirrorService)
    private readonly taskMirrorService: TaskMirrorService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
    @Inject(DiscussionJournalStorageService)
    private readonly journalStorage: DiscussionJournalStorageService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  validateTaskReadableForCurrentUser(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
  ): void {
    this.assertProjectExists(projectId);
    this.assertProjectChartExists(projectId, chartId);
    this.assertCanViewProject(authContext, projectId);
    this.taskMirrorService.assertTaskExistsInCurrentChart(projectId, chartId, taskId);
  }

  resolveProjectGanttChartId(projectId: number, chartId: number): number {
    return this.assertProjectChartExists(projectId, chartId).id;
  }

  ensureTaskMirrorExistsForReadableTask(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
  ): void {
    const chart = this.assertProjectChartExists(projectId, chartId);
    this.validateTaskReadableForCurrentUser(authContext, projectId, chartId, taskId);
    this.taskMirrorService.ensureTaskMirrorExists(chart.id, taskId);
  }

  assertTaskDiscussionManageableForCurrentUser(
    authContext: AuthContext,
    projectId: number,
    forbiddenMessage = TASK_DISCUSSION_MANAGE_FORBIDDEN_MESSAGE,
  ): void {
    this.assertProjectExists(projectId);
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
          throw new ForbiddenException(forbiddenMessage);
        }
      },
    );
  }

  async deleteTaskAttachment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    attachmentId: string,
  ): Promise<{ deletedAttachmentId: string }> {
    const chart = this.assertProjectChartExists(projectId, chartId);
    this.validateTaskReadableForCurrentUser(authContext, projectId, chartId, taskId);
    this.assertTaskDiscussionManageableForCurrentUser(authContext, projectId);

    const deletedAttachmentId = await this.attachmentService.deleteTaskAttachmentLink(
      chart.id,
      taskId,
      attachmentId,
    );

    return { deletedAttachmentId };
  }

  async uploadTaskAttachment(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    buffer: Buffer,
    originalFilename: string,
  ): Promise<{ attachment: DiscussionAttachmentSummary }> {
    const chart = this.assertProjectChartExists(projectId, chartId);
    this.validateTaskReadableForCurrentUser(authContext, projectId, chartId, taskId);
    this.assertTaskDiscussionManageableForCurrentUser(authContext, projectId);
    this.taskMirrorService.ensureTaskMirrorExists(chart.id, taskId);

    const attachment = await this.attachmentService.createAttachmentAndLinkToTask({
      buffer,
      originalFilename,
      projectGanttChartId: chart.id,
      projectId,
      taskId,
      uploadedByUserId: authContext.userId,
    });
    await this.notificationsService.notifyTaskAttachmentCreated({
      actorUserId: authContext.userId,
      attachmentId: attachment.id,
      chartId,
      projectId,
      taskId,
    });

    return { attachment };
  }

  async getTaskJournal(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
  ): Promise<{
    journalExists: boolean;
    markdown: string | null;
    taskMirrorExists: boolean;
  }> {
    const chart = this.assertProjectChartExists(projectId, chartId);
    this.validateTaskReadableForCurrentUser(authContext, projectId, chartId, taskId);
    const taskMirrorExists = this.taskMirrorService.taskMirrorExists(chart.id, taskId);
    const markdown = taskMirrorExists
      ? await this.journalStorage.readTaskJournal(projectId, chartId, taskId)
      : null;

    return {
      journalExists: markdown !== null,
      markdown,
      taskMirrorExists,
    };
  }

  async updateTaskJournal(
    authContext: AuthContext,
    projectId: number,
    chartId: number,
    taskId: string,
    markdown: string,
  ): Promise<{
    journalExists: boolean;
    markdown: string | null;
    taskMirrorExists: boolean;
  }> {
    const chart = this.assertProjectChartExists(projectId, chartId);
    this.validateTaskReadableForCurrentUser(authContext, projectId, chartId, taskId);
    this.assertTaskDiscussionManageableForCurrentUser(authContext, projectId);
    const previousMarkdown = await this.journalStorage.readTaskJournal(
      projectId,
      chartId,
      taskId,
    );

    const taskMirrorExisted = this.taskMirrorService.taskMirrorExists(chart.id, taskId);
    if (!taskMirrorExisted) {
      this.taskMirrorService.ensureTaskMirrorExists(chart.id, taskId);
    }

    try {
      await this.journalStorage.writeTaskJournal(projectId, chartId, taskId, markdown);
    } catch (error) {
      if (!taskMirrorExisted) {
        this.taskMirrorService.deleteTaskMirror(chart.id, taskId);
      }
      throw error;
    }
    await this.notificationsService.notifyTaskJournalUpdated({
      actorUserId: authContext.userId,
      chartId,
      markdown,
      previousMarkdown,
      projectId,
      taskId,
    });
    await this.notificationsService.notifyTaskJournalMentions({
      actorUserId: authContext.userId,
      chartId,
      markdown,
      projectId,
      taskId,
    });

    return {
      journalExists: true,
      markdown,
      taskMirrorExists: true,
    };
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

  private assertProjectChartExists(projectId: number, chartId: number) {
    const chart = this.databaseService.db.select()
      .from(projectGanttCharts)
      .where(
        and(
          eq(projectGanttCharts.projectId, projectId),
          eq(projectGanttCharts.chartId, chartId),
        ),
      )
      .get();
    if (!chart) {
      throw new NotFoundException("Project chart not found");
    }
    return chart;
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
}
