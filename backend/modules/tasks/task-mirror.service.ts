import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { taskComments, taskMirror } from "../../../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import { DiscussionAttachmentService } from "../discussion/discussion-attachment.service.js";
import { DiscussionCommentBodyStorageService } from "../discussion/discussion-comment-body-storage.service.js";
import { DiscussionJournalStorageService } from "../discussion/discussion-journal-storage.service.js";
import { ProjectChartsService } from "../project-charts/project-charts.service.js";
import { collectProjectChartTaskIdsBestEffort } from "../project-charts/project-chart-task-id-validation.js";

const TASK_NOT_FOUND_MESSAGE = "Task not found";

@Injectable()
export class TaskMirrorService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(ProjectChartsService)
    private readonly projectChartsService: ProjectChartsService,
    @Inject(DiscussionCommentBodyStorageService)
    private readonly commentBodyStorage: DiscussionCommentBodyStorageService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
    @Inject(DiscussionJournalStorageService)
    private readonly journalStorage: DiscussionJournalStorageService,
  ) {}

  ensureTaskMirrorExists(projectId: number, taskId: string): void {
    this.databaseService.db.insert(taskMirror)
      .values({ projectId, taskId })
      .onConflictDoNothing()
      .run();
  }

  assertTaskExistsInCurrentChart(projectId: number, taskId: string): void {
    const taskIds = this.listTaskIdsFromCurrentChart(projectId);
    if (!taskIds.includes(taskId)) {
      throw new NotFoundException(TASK_NOT_FOUND_MESSAGE);
    }
  }

  taskMirrorExists(projectId: number, taskId: string): boolean {
    const row = this.databaseService.db
      .select({ projectId: taskMirror.projectId })
      .from(taskMirror)
      .where(
        and(
          eq(taskMirror.projectId, projectId),
          eq(taskMirror.taskId, taskId),
        ),
      )
      .get();

    return Boolean(row);
  }

  deleteTaskMirror(projectId: number, taskId: string): void {
    this.databaseService.db.delete(taskMirror)
      .where(
        and(
          eq(taskMirror.projectId, projectId),
          eq(taskMirror.taskId, taskId),
        ),
      )
      .run();
  }

  listTaskIdsFromCurrentChart(projectId: number): string[] {
    const chartXml = this.projectChartsService.readProjectChart(projectId);
    if (chartXml === null) {
      return [];
    }

    return collectProjectChartTaskIdsBestEffort(chartXml);
  }

  async deleteRemovedTaskMirrorData(
    projectId: number,
    removedTaskIds: readonly string[],
  ): Promise<void> {
    if (removedTaskIds.length === 0) {
      return;
    }

    const commentRows = this.databaseService.db
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
      })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.projectId, projectId),
          inArray(taskComments.taskId, [...removedTaskIds]),
        ),
      )
      .all();

    for (const row of commentRows) {
      await this.commentBodyStorage.deleteTaskCommentBody(
        projectId,
        row.taskId,
        row.id,
      );
    }

    for (const taskId of removedTaskIds) {
      await this.journalStorage.deleteTaskJournal(projectId, taskId);
    }

    this.databaseService.db.delete(taskMirror)
      .where(
        and(
          eq(taskMirror.projectId, projectId),
          inArray(taskMirror.taskId, [...removedTaskIds]),
        ),
      )
      .run();

    await this.attachmentService.removeOrphanAttachmentsAndFiles();
  }
}
