import path from "node:path";

const MAX_MGR_UPLOAD_FILENAME_LENGTH = 255;

function isDisallowedMgrUploadFilenameSegment(name: string): boolean {
  if (name.length === 0 || name.length > MAX_MGR_UPLOAD_FILENAME_LENGTH) {
    return true;
  }

  if (name.includes("/") || name.includes("\\")) {
    return true;
  }

  if (name.includes("\0")) {
    return true;
  }

  if (name === "." || name === "..") {
    return true;
  }

  return false;
}

export function sanitizeMgrUploadFilename(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (
    trimmed.includes("/")
    || trimmed.includes("\\")
    || trimmed.includes("..")
  ) {
    return null;
  }

  const base = path.basename(trimmed);
  if (isDisallowedMgrUploadFilenameSegment(base)) {
    return null;
  }

  return base;
}

export function resolveMgrUploadFilePath(
  uploadsRootDir: string,
  rawFilename: string,
): string | null {
  const safeName = sanitizeMgrUploadFilename(rawFilename);
  if (!safeName) {
    return null;
  }

  const resolvedRoot = path.resolve(uploadsRootDir);
  const resolvedFile = path.resolve(resolvedRoot, safeName);
  const relative = path.relative(resolvedRoot, resolvedFile);

  if (
    relative === ""
    || relative.startsWith("..")
    || path.isAbsolute(relative)
  ) {
    return null;
  }

  return resolvedFile;
}
