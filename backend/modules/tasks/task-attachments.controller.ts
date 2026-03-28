import {
  BadRequestException,
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
import { DiscussionUploadMultipartInterceptor } from "../discussion/discussion-upload-multipart.interceptor.js";
import type { MemoryUploadedFile } from "../discussion/memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "../discussion/uploaded-memory-file.decorator.js";
import { TaskMirrorService } from "./task-mirror.service.js";
import {
  deleteTaskAttachmentResponseSchema,
  listTaskAttachmentsResponseSchema,
  taskAttachmentRouteParamsSchema,
  taskCommentsRouteParamsSchema,
  uploadTaskAttachmentResponseSchema,
} from "./task-untrusted.contracts.js";
import { TasksService } from "./tasks.service.js";

const MISSING_UPLOAD_FILE_MESSAGE = "Multipart field 'file' is required";

function requireUploadedBuffer(file: MemoryUploadedFile | undefined): Buffer {
  if (!file?.buffer) {
    throw new BadRequestException(MISSING_UPLOAD_FILE_MESSAGE);
  }

  return file.buffer;
}

function buildAttachmentContentDisposition(originalFilename: string): string {
  const safeName = originalFilename.replace(/["\r\n]/g, "_").trim() || "attachment";

  return `attachment; filename="${safeName}"`;
}

@Authenticated()
@Controller("projects/:projectId/tasks/:taskId/attachments")
export class TaskAttachmentsController {
  constructor(
    @Inject(TasksService)
    private readonly tasksService: TasksService,
    @Inject(TaskMirrorService)
    private readonly taskMirrorService: TaskMirrorService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
  ) {}

  @Get()
  listTaskAttachments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);
    this.tasksService.validateTaskReadableForCurrentUser(
      request.authContext!,
      projectId,
      taskId,
    );

    const rows = this.attachmentService.listTaskLevelAttachmentRows(projectId, taskId);
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
    const { projectId, taskId } = taskCommentsRouteParamsSchema.parse(params);
    this.tasksService.validateTaskReadableForCurrentUser(
      request.authContext!,
      projectId,
      taskId,
    );

    this.taskMirrorService.ensureTaskMirrorExists(projectId, taskId);
    const attachment = await this.attachmentService.createAttachmentAndLinkToTask({
      buffer: requireUploadedBuffer(file),
      originalFilename: file!.originalname,
      projectId,
      taskId,
      uploadedByUserId: request.authContext!.userId,
    });

    return uploadTaskAttachmentResponseSchema.parse({ attachment });
  }

  @Delete(":attachmentId")
  async deleteTaskAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(taskAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, projectId, taskId } =
      taskAttachmentRouteParamsSchema.parse(params);

    return deleteTaskAttachmentResponseSchema.parse(
      await this.tasksService.deleteTaskAttachment(
        request.authContext!,
        projectId,
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
    const { attachmentId, projectId, taskId } =
      taskAttachmentRouteParamsSchema.parse(params);

    this.tasksService.validateTaskReadableForCurrentUser(
      request.authContext!,
      projectId,
      taskId,
    );

    const row = this.attachmentService.requireAttachmentLinkedToTask(
      projectId,
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
