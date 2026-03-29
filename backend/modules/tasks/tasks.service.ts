import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { projects } from "../../../db/index.js";
import {
  hasEffectiveProjectManagerRole,
  hasProjectAccess,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import { DiscussionAttachmentService } from "../discussion/discussion-attachment.service.js";
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
  ) {}

  validateTaskReadableForCurrentUser(
    authContext: AuthContext,
    projectId: number,
    taskId: string,
  ): void {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);
    this.taskMirrorService.assertTaskExistsInCurrentChart(projectId, taskId);
  }

  ensureTaskMirrorExistsForReadableTask(
    authContext: AuthContext,
    projectId: number,
    taskId: string,
  ): void {
    this.validateTaskReadableForCurrentUser(authContext, projectId, taskId);
    this.taskMirrorService.ensureTaskMirrorExists(projectId, taskId);
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
    taskId: string,
    attachmentId: string,
  ): Promise<{ deletedAttachmentId: string }> {
    this.validateTaskReadableForCurrentUser(authContext, projectId, taskId);
    this.assertTaskDiscussionManageableForCurrentUser(authContext, projectId);

    const deletedAttachmentId = await this.attachmentService.deleteTaskAttachmentLink(
      projectId,
      taskId,
      attachmentId,
    );

    return { deletedAttachmentId };
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
}
