import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import { MULTIPART_MEMORY_FILE_KEY } from "./discussion-upload.constants.js";
import type { MemoryUploadedFile } from "./memory-uploaded-file.types.js";

export const UploadedMemoryFile = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemoryUploadedFile | undefined => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return request[MULTIPART_MEMORY_FILE_KEY] as MemoryUploadedFile | undefined;
  },
);
