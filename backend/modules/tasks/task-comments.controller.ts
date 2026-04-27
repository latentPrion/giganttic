import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UseInterceptors,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DiscussionAttachmentService } from "../discussion/discussion-attachment.service.js";
import { buildAttachmentContentDisposition } from "../discussion/discussion-upload-controller.utils.js";
import { DiscussionUploadMultipartInterceptor } from "../discussion/discussion-upload-multipart.interceptor.js";
import type { MemoryUploadedFile } from "../discussion/memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "../discussion/uploaded-memory-file.decorator.js";
import { TaskCommentService } from "./task-comment.service.js";
import { TasksService } from "./tasks.service.js";
import {
  createTaskCommentRequestSchema,
  deleteTaskAttachmentResponseSchema,
  deleteTaskCommentResponseSchema,
  getTaskCommentResponseSchema,
  listTaskCommentsResponseSchema,
  taskCommentAttachmentRouteParamsSchema,
  taskCommentRouteParamsSchema,
  taskCommentsRouteParamsSchema,
  updateTaskCommentRequestSchema,
  uploadTaskAttachmentResponseSchema,
} from "./task-untrusted.contracts.js";

const MISSING_UPLOAD_FILE_MESSAGE = "Multipart field 'file' is required";

function requireUploadedBuffer(file: MemoryUploadedFile | undefined): Buffer {
  if (!file?.buffer) {
    throw new BadRequestException(MISSING_UPLOAD_FILE_MESSAGE);
  }

  return file.buffer;
}

@Authenticated()
@Controller("projects/:projectId/charts/:chartId/tasks/:taskId/comments")
export class TaskCommentsController {
  constructor(
    @Inject(TaskCommentService)
    private readonly taskCommentService: TaskCommentService,
    @Inject(TasksService)
    private readonly tasksService: TasksService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
  ) {}

  @Get()
  async listComments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { chartId, projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);

    return listTaskCommentsResponseSchema.parse(
      await this.taskCommentService.listComments(
        request.authContext!,
        projectId,
        chartId,
        taskId,
      ),
    );
  }

  @Post()
  async createComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(createTaskCommentRequestSchema)) body: unknown,
  ) {
    const { chartId, projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);

    return getTaskCommentResponseSchema.parse(
      await this.taskCommentService.createComment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        body as never,
      ),
    );
  }

  @Get(":commentId")
  async getComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentRouteParamsSchema)) params: unknown,
  ) {
    const { chartId, commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return getTaskCommentResponseSchema.parse(
      await this.taskCommentService.getComment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        commentId,
      ),
    );
  }

  @Patch(":commentId")
  async updateComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateTaskCommentRequestSchema)) body: unknown,
  ) {
    const { chartId, commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return getTaskCommentResponseSchema.parse(
      await this.taskCommentService.updateComment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        commentId,
        body as never,
      ),
    );
  }

  @Delete(":commentId")
  async deleteComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentRouteParamsSchema)) params: unknown,
  ) {
    const { chartId, commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return deleteTaskCommentResponseSchema.parse(
      await this.taskCommentService.deleteComment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        commentId,
      ),
    );
  }

  @Delete(":commentId/attachments/:attachmentId")
  async deleteCommentAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, chartId, commentId, projectId, taskId } =
      taskCommentAttachmentRouteParamsSchema.parse(params);

    return deleteTaskAttachmentResponseSchema.parse(
      await this.taskCommentService.deleteCommentAttachment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        commentId,
        attachmentId,
      ),
    );
  }

  @Post(":commentId/attachments")
  @UseInterceptors(DiscussionUploadMultipartInterceptor)
  async uploadCommentAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentRouteParamsSchema)) params: unknown,
    @UploadedMemoryFile() file: MemoryUploadedFile | undefined,
  ) {
    const { chartId, commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return uploadTaskAttachmentResponseSchema.parse(
      await this.taskCommentService.uploadCommentAttachment(
        request.authContext!,
        projectId,
        chartId,
        taskId,
        commentId,
        requireUploadedBuffer(file),
        file!.originalname,
      ),
    );
  }

  @Get(":commentId/attachments/:attachmentId/download")
  downloadCommentAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, chartId, commentId, projectId, taskId } =
      taskCommentAttachmentRouteParamsSchema.parse(params);

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

    const row = this.attachmentService.requireAttachmentLinkedToTaskComment(
      projectGanttChartId,
      taskId,
      commentId,
      attachmentId,
    );

    return new StreamableFile(
      this.attachmentService.getAttachmentFileStream(attachmentId),
      {
        disposition: buildAttachmentContentDisposition(row.originalFilename),
        type: "application/octet-stream",
      },
    );
  }
}
