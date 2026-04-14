import { describe, expect, it } from "vitest";

import {
  resolveMgrUploadFilePath,
  sanitizeMgrUploadFilename,
} from "./mgr-upload-filename.utils.js";

describe("sanitizeMgrUploadFilename", () => {
  it("accepts simple filenames and extensions", () => {
    expect(sanitizeMgrUploadFilename("a.png")).toBe("a.png");
    expect(sanitizeMgrUploadFilename("x.unknownext")).toBe("x.unknownext");
  });

  it("rejects path separators and traversal segments", () => {
    expect(sanitizeMgrUploadFilename("../x")).toBeNull();
    expect(sanitizeMgrUploadFilename("a/b")).toBeNull();
    expect(sanitizeMgrUploadFilename("a\\b")).toBeNull();
  });

  it("rejects embedded relative segments even when basename looks safe", () => {
    expect(sanitizeMgrUploadFilename("ignored/../ok.txt")).toBeNull();
  });
});

describe("resolveMgrUploadFilePath", () => {
  it("resolves inside the uploads root only", () => {
    const root = "/tmp/uploads-root";
    expect(resolveMgrUploadFilePath(root, "ok.bin")).toBe("/tmp/uploads-root/ok.bin");
    expect(resolveMgrUploadFilePath(root, "../evil")).toBeNull();
  });
});
