import { BadRequestException } from "@nestjs/common";

import type { MemoryUploadedFile } from "./memory-uploaded-file.types.js";

const MISSING_UPLOAD_FILE_MESSAGE = "Multipart field 'file' is required";

export function requireUploadedBuffer(
  file: MemoryUploadedFile | undefined,
): Buffer {
  if (!file?.buffer) {
    throw new BadRequestException(MISSING_UPLOAD_FILE_MESSAGE);
  }

  return file.buffer;
}

export function buildAttachmentContentDisposition(
  originalFilename: string,
): string {
  const safeName = originalFilename.replace(/["\r\n]/g, "_").trim() || "attachment";
  return `attachment; filename="${safeName}"`;
}
