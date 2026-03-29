import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Inject, Injectable } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";

function encodeTaskJournalTaskId(taskId: string): string {
  return encodeURIComponent(taskId);
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
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
export class DiscussionJournalStorageService {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly config: BackendConfig,
  ) {}

  async ensureUntrustedDirectoriesExist(): Promise<void> {
    await Promise.all([
      mkdir(this.config.untrustedContentProjectJournalsDir, { recursive: true }),
      mkdir(this.config.untrustedContentIssueJournalsDir, { recursive: true }),
      mkdir(this.config.untrustedContentTaskJournalsDir, { recursive: true }),
    ]);
  }

  resolveProjectJournalMarkdownPath(projectId: number): string {
    return path.join(
      this.config.untrustedContentProjectJournalsDir,
      `${projectId}.md`,
    );
  }

  resolveIssueJournalMarkdownPath(projectId: number, issueId: number): string {
    return path.join(
      this.config.untrustedContentIssueJournalsDir,
      `${projectId}-${issueId}.md`,
    );
  }

  resolveTaskJournalMarkdownPath(projectId: number, taskId: string): string {
    return path.join(
      this.config.untrustedContentTaskJournalsDir,
      `${projectId}--${encodeTaskJournalTaskId(taskId)}.md`,
    );
  }

  async readProjectJournal(projectId: number): Promise<string | null> {
    return readFileIfExists(this.resolveProjectJournalMarkdownPath(projectId));
  }

  async readIssueJournal(projectId: number, issueId: number): Promise<string | null> {
    return readFileIfExists(
      this.resolveIssueJournalMarkdownPath(projectId, issueId),
    );
  }

  async readTaskJournal(projectId: number, taskId: string): Promise<string | null> {
    return readFileIfExists(this.resolveTaskJournalMarkdownPath(projectId, taskId));
  }

  async writeProjectJournal(projectId: number, markdown: string): Promise<void> {
    await this.ensureUntrustedDirectoriesExist();
    await writeFile(this.resolveProjectJournalMarkdownPath(projectId), markdown, "utf8");
  }

  async writeIssueJournal(
    projectId: number,
    issueId: number,
    markdown: string,
  ): Promise<void> {
    await this.ensureUntrustedDirectoriesExist();
    await writeFile(
      this.resolveIssueJournalMarkdownPath(projectId, issueId),
      markdown,
      "utf8",
    );
  }

  async writeTaskJournal(
    projectId: number,
    taskId: string,
    markdown: string,
  ): Promise<void> {
    await this.ensureUntrustedDirectoriesExist();
    await writeFile(
      this.resolveTaskJournalMarkdownPath(projectId, taskId),
      markdown,
      "utf8",
    );
  }

  async deleteProjectJournal(projectId: number): Promise<void> {
    await unlinkQuietly(this.resolveProjectJournalMarkdownPath(projectId));
  }

  async deleteIssueJournal(projectId: number, issueId: number): Promise<void> {
    await unlinkQuietly(this.resolveIssueJournalMarkdownPath(projectId, issueId));
  }

  async deleteTaskJournal(projectId: number, taskId: string): Promise<void> {
    await unlinkQuietly(this.resolveTaskJournalMarkdownPath(projectId, taskId));
  }
}
