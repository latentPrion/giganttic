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
  UseInterceptors,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DiscussionAttachmentService } from "../discussion/discussion-attachment.service.js";
import { DiscussionUploadMultipartInterceptor } from "../discussion/discussion-upload-multipart.interceptor.js";
import type { MemoryUploadedFile } from "../discussion/memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "../discussion/uploaded-memory-file.decorator.js";
import { TaskMirrorService } from "./task-mirror.service.js";
import { TaskCommentService } from "./task-comment.service.js";
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
@Controller("projects/:projectId/tasks/:taskId/comments")
export class TaskCommentsController {
  constructor(
    @Inject(TaskCommentService)
    private readonly taskCommentService: TaskCommentService,
    @Inject(TaskMirrorService)
    private readonly taskMirrorService: TaskMirrorService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
  ) {}

  @Get()
  async listComments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);

    return listTaskCommentsResponseSchema.parse(
      await this.taskCommentService.listComments(
        request.authContext!,
        projectId,
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
    const { projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);

    return getTaskCommentResponseSchema.parse(
      await this.taskCommentService.createComment(
        request.authContext!,
        projectId,
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
    const { commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return getTaskCommentResponseSchema.parse(
      await this.taskCommentService.getComment(
        request.authContext!,
        projectId,
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
    const { commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return getTaskCommentResponseSchema.parse(
      await this.taskCommentService.updateComment(
        request.authContext!,
        projectId,
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
    const { commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    return deleteTaskCommentResponseSchema.parse(
      await this.taskCommentService.deleteComment(
        request.authContext!,
        projectId,
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
    const { attachmentId, commentId, projectId, taskId } =
      taskCommentAttachmentRouteParamsSchema.parse(params);

    return deleteTaskAttachmentResponseSchema.parse(
      await this.taskCommentService.deleteCommentAttachment(
        request.authContext!,
        projectId,
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
    const { commentId, projectId, taskId } = taskCommentRouteParamsSchema.parse(
      params,
    );

    this.taskMirrorService.ensureTaskMirrorExists(projectId, taskId);
    const attachment = await this.attachmentService.createAttachmentAndLinkToTaskComment({
      buffer: requireUploadedBuffer(file),
      commentId,
      originalFilename: file!.originalname,
      projectId,
      taskId,
      uploadedByUserId: request.authContext!.userId,
    });

    return uploadTaskAttachmentResponseSchema.parse({ attachment });
  }
}
