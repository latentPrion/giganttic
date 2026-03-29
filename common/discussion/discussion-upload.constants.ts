const BYTE = 1;
const KIBIBYTE = 1024 * BYTE;
const MEBIBYTE = 1024 * KIBIBYTE;

const MIN_BYTES_LABEL = "0 B";

export const DEFAULT_DISCUSSION_ATTACHMENT_MAX_UPLOAD_BYTES = 5 * MEBIBYTE;

export function formatDiscussionByteLength(byteLength: number): string {
  if (byteLength <= 0) {
    return MIN_BYTES_LABEL;
  }

  if (byteLength < KIBIBYTE) {
    return `${byteLength} B`;
  }

  if (byteLength < MEBIBYTE) {
    return `${(byteLength / KIBIBYTE).toFixed(1)} KiB`;
  }

  return `${(byteLength / MEBIBYTE).toFixed(1)} MiB`;
}

export function createDiscussionMaxFileSizeMessage(): string {
  return `Max file size: ${formatDiscussionByteLength(DEFAULT_DISCUSSION_ATTACHMENT_MAX_UPLOAD_BYTES)} per file.`;
}
