import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  StreamableFile,
  UseInterceptors,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DiscussionAttachmentService, toAttachmentSummary } from "../discussion/discussion-attachment.service.js";
import {
  buildAttachmentContentDisposition,
  requireUploadedBuffer,
} from "../discussion/discussion-upload-controller.utils.js";
import { DiscussionUploadMultipartInterceptor } from "../discussion/discussion-upload-multipart.interceptor.js";
import type { MemoryUploadedFile } from "../discussion/memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "../discussion/uploaded-memory-file.decorator.js";
import {
  deleteTaskAttachmentResponseSchema,
  listTaskAttachmentsResponseSchema,
  taskAttachmentRouteParamsSchema,
  taskCommentsRouteParamsSchema,
  uploadTaskAttachmentResponseSchema,
} from "./task-untrusted.contracts.js";
import { TasksService } from "./tasks.service.js";

@Authenticated()
@Controller("projects/:projectId/charts/:chartId/tasks/:taskId/attachments")
export class TaskAttachmentsController {
  constructor(
    @Inject(TasksService)
    private readonly tasksService: TasksService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
  ) {}

  @Get()
  listTaskAttachments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { chartId, projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);
    this.tasksService.validateTaskReadableForCurrentUser(
      request.authContext!,
      projectId,
      chartId,
      taskId,
    );
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );

    const rows = this.attachmentService.listTaskLevelAttachmentRows(projectGanttChartId, taskId);
    return listTaskAttachmentsResponseSchema.parse({
      attachments: rows.map(toAttachmentSummary),
    });
  }

  @Post()
  @UseInterceptors(DiscussionUploadMultipartInterceptor)
  async uploadTaskAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
    @UploadedMemoryFile() file: MemoryUploadedFile | undefined,
  ) {
    const { chartId, projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);
    return uploadTaskAttachmentResponseSchema.parse(
      await this.tasksService.uploadTaskAttachment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        requireUploadedBuffer(file),
        file!.originalname,
      ),
    );
  }

  @Delete(":attachmentId")
  async deleteTaskAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, chartId, projectId, taskId } =
      taskAttachmentRouteParamsSchema.parse(params);

    return deleteTaskAttachmentResponseSchema.parse(
      await this.tasksService.deleteTaskAttachment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        attachmentId,
      ),
    );
  }

  @Get(":attachmentId/download")
  downloadTaskAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, chartId, projectId, taskId } =
      taskAttachmentRouteParamsSchema.parse(params);

    this.tasksService.validateTaskReadableForCurrentUser(
      request.authContext!,
      projectId,
      chartId,
      taskId,
    );
    const projectGanttChartId = this.tasksService.resolveProjectGanttChartId(
      projectId,
      chartId,
    );

    const row = this.attachmentService.requireAttachmentLinkedToTask(
      projectGanttChartId,
      taskId,
      attachmentId,
    );
    const stream = this.attachmentService.getAttachmentFileStream(attachmentId);

    return new StreamableFile(stream, {
      disposition: buildAttachmentContentDisposition(row.originalFilename),
      type: "application/octet-stream",
    });
  }
}
