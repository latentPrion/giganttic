import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Inject, Injectable } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";

const TASK_ID_HASH_LENGTH = 24;

function createSafeTaskIdHash(taskId: string): string {
  return createHash("sha256")
    .update(taskId)
    .digest("hex")
    .slice(0, TASK_ID_HASH_LENGTH);
}

async function readFileOrEmpty(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return "";
}

async function unlinkQuietly(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

@Injectable()
export class DiscussionCommentBodyStorageService {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly config: BackendConfig,
  ) {}

  async ensureUntrustedDirectoriesExist(): Promise<void> {
    await mkdir(this.config.untrustedContentIssueCommentsDir, {
      recursive: true,
    });
    await mkdir(this.config.untrustedContentTaskCommentsDir, {
      recursive: true,
    });
  }

  resolveIssueCommentMarkdownPath(
    projectId: number,
    issueId: number,
    commentId: number,
  ): string {
    return path.join(
      this.config.untrustedContentIssueCommentsDir,
      `${projectId}-${issueId}-${commentId}.md`,
    );
  }

  resolveTaskCommentMarkdownPath(
    projectId: number,
    taskId: string,
    commentId: number,
  ): string {
    return path.join(
      this.config.untrustedContentTaskCommentsDir,
      `${projectId}-${createSafeTaskIdHash(taskId)}-${commentId}.md`,
    );
  }

  async readIssueCommentBody(
    projectId: number,
    issueId: number,
    commentId: number,
  ): Promise<string> {
    return readFileOrEmpty(
      this.resolveIssueCommentMarkdownPath(projectId, issueId, commentId),
    );
  }

  async readTaskCommentBody(
    projectId: number,
    taskId: string,
    commentId: number,
  ): Promise<string> {
    return readFileOrEmpty(
      this.resolveTaskCommentMarkdownPath(projectId, taskId, commentId),
    );
  }

  async writeIssueCommentBody(
    projectId: number,
    issueId: number,
    commentId: number,
    body: string,
  ): Promise<void> {
    await this.ensureUntrustedDirectoriesExist();
    await writeFile(
      this.resolveIssueCommentMarkdownPath(projectId, issueId, commentId),
      body,
      "utf8",
    );
  }

  async writeTaskCommentBody(
    projectId: number,
    taskId: string,
    commentId: number,
    body: string,
  ): Promise<void> {
    await this.ensureUntrustedDirectoriesExist();
    await writeFile(
      this.resolveTaskCommentMarkdownPath(projectId, taskId, commentId),
      body,
      "utf8",
    );
  }

  async deleteIssueCommentBody(
    projectId: number,
    issueId: number,
    commentId: number,
  ): Promise<void> {
    await unlinkQuietly(
      this.resolveIssueCommentMarkdownPath(projectId, issueId, commentId),
    );
  }

  async deleteTaskCommentBody(
    projectId: number,
    taskId: string,
    commentId: number,
  ): Promise<void> {
    await unlinkQuietly(
      this.resolveTaskCommentMarkdownPath(projectId, taskId, commentId),
    );
  }
}
