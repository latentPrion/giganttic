import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildBackendConfig } from "../../config/backend-config.js";
import { DiscussionCommentBodyStorageService } from "./discussion-comment-body-storage.service.js";

describe("DiscussionCommentBodyStorageService", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  });

  async function createService() {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "giganttic-discussion-body-"));
    tempDirs.push(tempDir);

    return new DiscussionCommentBodyStorageService(
      buildBackendConfig({
        untrustedContentIssueCommentsDir: path.join(tempDir, "issue-comments"),
        untrustedContentTaskCommentsDir: path.join(tempDir, "task-comments"),
      }),
    );
  }

  it("writes, reads, and deletes issue comment bodies", async () => {
    const service = await createService();

    await service.writeIssueCommentBody(42, 7, 9, "Issue body");
    expect(await service.readIssueCommentBody(42, 7, 9)).toBe("Issue body");

    await service.deleteIssueCommentBody(42, 7, 9);
    expect(await service.readIssueCommentBody(42, 7, 9)).toBe("");
  });

  it("writes, reads, and deletes task comment bodies", async () => {
    const service = await createService();

    await service.writeTaskCommentBody(42, "task-7", 11, "Task body");
    expect(await service.readTaskCommentBody(42, "task-7", 11)).toBe("Task body");

    await service.deleteTaskCommentBody(42, "task-7", 11);
    expect(await service.readTaskCommentBody(42, "task-7", 11)).toBe("");
  });

  it("hashes task ids in task markdown paths instead of exposing raw task ids", async () => {
    const service = await createService();
    const rawTaskId = "phase/one:task?alpha";

    const firstPath = service.resolveTaskCommentMarkdownPath(42, rawTaskId, 11);
    const secondPath = service.resolveTaskCommentMarkdownPath(42, rawTaskId, 11);

    expect(firstPath).toBe(secondPath);
    expect(firstPath).toContain(`${path.sep}task-comments${path.sep}`);
    expect(firstPath).toContain("42-");
    expect(firstPath).toContain("-11.md");
    expect(firstPath).not.toContain(rawTaskId);
  });
});
