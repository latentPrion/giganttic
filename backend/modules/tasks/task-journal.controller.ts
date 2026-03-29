import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Req,
} from "@nestjs/common";

import {
  getTaskJournalResponseSchema,
  upsertDiscussionJournalRequestSchema,
} from "../../../common/discussion/discussion-journal.contracts.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { taskCommentsRouteParamsSchema } from "./task-untrusted.contracts.js";
import { TasksService } from "./tasks.service.js";

@Authenticated()
@Controller("projects/:projectId/tasks/:taskId/journal")
export class TaskJournalController {
  constructor(
    @Inject(TasksService)
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  async getTaskJournal(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);

    return getTaskJournalResponseSchema.parse(
      await this.tasksService.getTaskJournal(
        request.authContext!,
        projectId,
        taskId,
      ),
    );
  }

  @Put()
  async updateTaskJournal(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(upsertDiscussionJournalRequestSchema)) body: unknown,
  ) {
    const { projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);
    const { markdown } = upsertDiscussionJournalRequestSchema.parse(body);

    return getTaskJournalResponseSchema.parse(
      await this.tasksService.updateTaskJournal(
        request.authContext!,
        projectId,
        taskId,
        markdown,
      ),
    );
  }
}
