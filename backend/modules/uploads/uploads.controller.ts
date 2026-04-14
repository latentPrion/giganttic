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
import { requireUploadedBuffer } from "../discussion/discussion-upload-controller.utils.js";
import type { MemoryUploadedFile } from "../discussion/memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "../discussion/uploaded-memory-file.decorator.js";
import { z } from "zod";

import {
  deleteMgrUploadResponseSchema,
  listMgrUploadsResponseSchema,
  uploadMgrUploadResponseSchema,
} from "./uploads.contracts.js";
import { MgrUploadsMultipartInterceptor } from "./mgr-uploads-multipart.interceptor.js";
import { UploadsService } from "./uploads.service.js";

const mgrUploadFilenameParamSchema = z.object({
  filename: z.string().trim().min(1),
});

@Controller("mgr-uploads")
export class UploadsController {
  constructor(
    @Inject(UploadsService)
    private readonly uploadsService: UploadsService,
  ) {}

  @Authenticated()
  @Get()
  async listMgrUploads(@Req() request: AuthenticatedRequest) {
    const [files, storage] = await Promise.all([
      this.uploadsService.listMgrUploadFiles(request.authContext!),
      this.uploadsService.readMgrUploadsStorage(request.authContext!),
    ]);
    return listMgrUploadsResponseSchema.parse({ files, storage });
  }

  @Authenticated()
  @Post()
  @UseInterceptors(MgrUploadsMultipartInterceptor)
  async uploadMgrUpload(
    @Req() request: AuthenticatedRequest,
    @UploadedMemoryFile() file: MemoryUploadedFile | undefined,
  ) {
    const buffer = requireUploadedBuffer(file);
    const uploaded = await this.uploadsService.uploadMgrUploadFile(
      request.authContext!,
      buffer,
      file!.originalname,
    );
    return uploadMgrUploadResponseSchema.parse({ file: uploaded });
  }

  @Authenticated()
  @Delete(":filename")
  async deleteMgrUpload(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(mgrUploadFilenameParamSchema)) params: unknown,
  ) {
    const { filename } = mgrUploadFilenameParamSchema.parse(params);
    const deletedFilename = await this.uploadsService.deleteMgrUploadFile(
      request.authContext!,
      filename,
    );
    return deleteMgrUploadResponseSchema.parse({ deletedFilename });
  }

  @Get(":filename")
  async downloadMgrUploadPublic(
    @Param(new ZodValidationPipe(mgrUploadFilenameParamSchema)) params: unknown,
  ): Promise<StreamableFile> {
    const { filename } = mgrUploadFilenameParamSchema.parse(params);
    await this.uploadsService.assertPublicMgrUploadFileExists(filename);
    const stream = this.uploadsService.resolvePublicMgrUploadReadStream(filename);
    return new StreamableFile(stream, {
      disposition: `inline; filename="${filename.replace(/"/g, "_")}"`,
      type: "application/octet-stream",
    });
  }
}
