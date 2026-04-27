import path from "node:path";

import { DEFAULT_DISCUSSION_ATTACHMENT_MAX_UPLOAD_BYTES } from "../../common/discussion/discussion-upload.constants.js";
import { MGR_UPLOADS_MAX_UPLOAD_BYTES } from "../../common/mgr-uploads/mgr-uploads.constants.js";
import { DEFAULT_NOTIFICATIONS_DROPDOWN_LIMIT } from "../modules/notifications/notifications.constants.js";
import {
  resolveRuntimeSchemaSnapshotSubdir,
  resolveRuntimeTarget,
} from "../../db/config.js";

const DEFAULT_MAX_ATTACHMENT_UPLOAD_BYTES = DEFAULT_DISCUSSION_ATTACHMENT_MAX_UPLOAD_BYTES;
const DEFAULT_MAX_ATTACHMENTS_PER_ISSUE_OR_COMMENT = 32;

const DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".csv",
  ".gif",
  ".jpeg",
  ".jpg",
  ".md",
  ".pdf",
  ".png",
  ".svg",
  ".txt",
  ".webp",
  ".xml",
] as const;

export interface BackendConfig {
  allowCloudGanttExportFallback: boolean;
  allowedAttachmentExtensions: readonly string[];
  chartsDir: string;
  createDbIfMissing: boolean;
  dbPath: string;
  ganttExportServerUrl: string | null;
  host: string;
  mgrUploadsMaxUploadBytes: number;
  maxAttachmentUploadBytes: number;
  maxAttachmentsPerIssueOrComment: number;
  notificationsDropdownLimit: number;
  port: number;
  routePrefix: string;
  runtimeSchemaSnapshotSubdir: string;
  sessionTtlMs: number;
  sharedInstanceUploadsDir: string;
  trustProxy: boolean;
  scopedSessionRouteAllowlist: ReadonlyArray<{
    method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    pattern: string;
  }>;
  untrustedContentAttachmentsDir: string;
  untrustedContentIssueCommentsDir: string;
  untrustedContentIssueJournalsDir: string;
  untrustedContentProjectJournalsDir: string;
  untrustedContentTaskCommentsDir: string;
  untrustedContentTaskJournalsDir: string;
}

export const BACKEND_CONFIG = Symbol("BACKEND_CONFIG");

function createDefaultSharedInstanceUploadsDir(cwd: string): string {
  return path.join(cwd, "uploads");
}

function createDefaultUntrustedAttachmentsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "attachments");
}

function createDefaultUntrustedIssueCommentsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "issue-comments");
}

function createDefaultUntrustedIssueJournalsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "issue-journals");
}

function createDefaultUntrustedProjectJournalsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "project-journals");
}

function createDefaultUntrustedTaskCommentsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "task-comments");
}

function createDefaultUntrustedTaskJournalsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "task-journals");
}

function createDefaultScopedSessionRouteAllowlist(): BackendConfig["scopedSessionRouteAllowlist"] {
  return [
    { method: "GET", pattern: "/auth/session/me" },
    { method: "GET", pattern: "/users/:userId" },
    { method: "GET", pattern: "/organizations" },
    { method: "GET", pattern: "/teams" },
    { method: "GET", pattern: "/projects" },
    { method: "GET", pattern: "/projects/chart-export-capabilities" },
    { method: "GET", pattern: "/projects/:projectId" },
    { method: "GET", pattern: "/projects/:projectId/journal" },
    { method: "PUT", pattern: "/projects/:projectId/journal" },
    { method: "GET", pattern: "/projects/:projectId/charts" },
    { method: "POST", pattern: "/projects/:projectId/charts" },
    { method: "GET", pattern: "/projects/:projectId/charts/:chartId" },
    { method: "PUT", pattern: "/projects/:projectId/charts/:chartId" },
    { method: "PATCH", pattern: "/projects/:projectId/charts/:chartId" },
    { method: "GET", pattern: "/projects/:projectId/attachments" },
    { method: "POST", pattern: "/projects/:projectId/attachments" },
    {
      method: "DELETE",
      pattern: "/projects/:projectId/attachments/:attachmentId",
    },
    {
      method: "GET",
      pattern: "/projects/:projectId/attachments/:attachmentId/download",
    },
    { method: "GET", pattern: "/projects/:projectId/issues" },
    { method: "POST", pattern: "/projects/:projectId/issues" },
    { method: "GET", pattern: "/projects/:projectId/issues/:issueId" },
    { method: "PATCH", pattern: "/projects/:projectId/issues/:issueId" },
    { method: "DELETE", pattern: "/projects/:projectId/issues/:issueId" },
    { method: "GET", pattern: "/projects/:projectId/issues/:issueId/journal" },
    { method: "PUT", pattern: "/projects/:projectId/issues/:issueId/journal" },
    { method: "GET", pattern: "/projects/:projectId/issues/:issueId/comments" },
    { method: "POST", pattern: "/projects/:projectId/issues/:issueId/comments" },
    {
      method: "GET",
      pattern: "/projects/:projectId/issues/:issueId/comments/:commentId",
    },
    {
      method: "PATCH",
      pattern: "/projects/:projectId/issues/:issueId/comments/:commentId",
    },
    {
      method: "DELETE",
      pattern: "/projects/:projectId/issues/:issueId/comments/:commentId",
    },
    {
      method: "POST",
      pattern:
        "/projects/:projectId/issues/:issueId/comments/:commentId/attachments",
    },
    {
      method: "DELETE",
      pattern:
        "/projects/:projectId/issues/:issueId/comments/:commentId/attachments/:attachmentId",
    },
    {
      method: "GET",
      pattern:
        "/projects/:projectId/issues/:issueId/comments/:commentId/attachments/:attachmentId/download",
    },
    {
      method: "GET",
      pattern: "/projects/:projectId/issues/:issueId/attachments",
    },
    {
      method: "POST",
      pattern: "/projects/:projectId/issues/:issueId/attachments",
    },
    {
      method: "DELETE",
      pattern: "/projects/:projectId/issues/:issueId/attachments/:attachmentId",
    },
    {
      method: "GET",
      pattern:
        "/projects/:projectId/issues/:issueId/attachments/:attachmentId/download",
    },
    { method: "GET", pattern: "/projects/:projectId/tasks/:taskId/comments" },
    { method: "POST", pattern: "/projects/:projectId/tasks/:taskId/comments" },
    {
      method: "GET",
      pattern: "/projects/:projectId/tasks/:taskId/comments/:commentId",
    },
    {
      method: "PATCH",
      pattern: "/projects/:projectId/tasks/:taskId/comments/:commentId",
    },
    {
      method: "DELETE",
      pattern: "/projects/:projectId/tasks/:taskId/comments/:commentId",
    },
    {
      method: "POST",
      pattern:
        "/projects/:projectId/tasks/:taskId/comments/:commentId/attachments",
    },
    {
      method: "DELETE",
      pattern:
        "/projects/:projectId/tasks/:taskId/comments/:commentId/attachments/:attachmentId",
    },
    {
      method: "GET",
      pattern:
        "/projects/:projectId/tasks/:taskId/comments/:commentId/attachments/:attachmentId/download",
    },
    { method: "GET", pattern: "/projects/:projectId/tasks/:taskId/attachments" },
    { method: "POST", pattern: "/projects/:projectId/tasks/:taskId/attachments" },
    {
      method: "DELETE",
      pattern: "/projects/:projectId/tasks/:taskId/attachments/:attachmentId",
    },
    {
      method: "GET",
      pattern:
        "/projects/:projectId/tasks/:taskId/attachments/:attachmentId/download",
    },
    { method: "GET", pattern: "/projects/:projectId/tasks/:taskId/journal" },
    { method: "PUT", pattern: "/projects/:projectId/tasks/:taskId/journal" },
    { method: "GET", pattern: "/notifications" },
    { method: "GET", pattern: "/notifications/summary" },
    { method: "GET", pattern: "/notifications/unnoticed" },
    {
      method: "POST",
      pattern: "/notifications/:notificationId/toggle-noticed",
    },
    { method: "GET", pattern: "/mgr-uploads" },
    { method: "POST", pattern: "/mgr-uploads" },
    { method: "DELETE", pattern: "/mgr-uploads/:filename" },
  ];
}

export function buildBackendConfig(
  overrides: Partial<BackendConfig> = {},
): BackendConfig {
  const cwd = process.cwd();
  return {
    allowCloudGanttExportFallback: true,
    allowedAttachmentExtensions: [...DEFAULT_ALLOWED_ATTACHMENT_EXTENSIONS],
    chartsDir: path.resolve(cwd, "charts"),
    createDbIfMissing: false,
    dbPath: path.resolve(cwd, resolveRuntimeTarget(process.env)),
    ganttExportServerUrl: null,
    host: "127.0.0.1",
    mgrUploadsMaxUploadBytes: MGR_UPLOADS_MAX_UPLOAD_BYTES,
    maxAttachmentUploadBytes: DEFAULT_MAX_ATTACHMENT_UPLOAD_BYTES,
    maxAttachmentsPerIssueOrComment: DEFAULT_MAX_ATTACHMENTS_PER_ISSUE_OR_COMMENT,
    notificationsDropdownLimit: DEFAULT_NOTIFICATIONS_DROPDOWN_LIMIT,
    port: 3000,
    routePrefix: "stc-proj-mgmt/api",
    runtimeSchemaSnapshotSubdir: resolveRuntimeSchemaSnapshotSubdir(process.env),
    sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
    sharedInstanceUploadsDir: createDefaultSharedInstanceUploadsDir(cwd),
    trustProxy: false,
    scopedSessionRouteAllowlist: createDefaultScopedSessionRouteAllowlist(),
    untrustedContentAttachmentsDir: createDefaultUntrustedAttachmentsDir(cwd),
    untrustedContentIssueCommentsDir: createDefaultUntrustedIssueCommentsDir(cwd),
    untrustedContentIssueJournalsDir: createDefaultUntrustedIssueJournalsDir(cwd),
    untrustedContentProjectJournalsDir: createDefaultUntrustedProjectJournalsDir(cwd),
    untrustedContentTaskCommentsDir: createDefaultUntrustedTaskCommentsDir(cwd),
    untrustedContentTaskJournalsDir: createDefaultUntrustedTaskJournalsDir(cwd),
    ...overrides,
  };
}

export function buildBackendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BackendConfig {
  const overrides: Partial<BackendConfig> = {};
  const cwd = process.cwd();

  overrides.allowCloudGanttExportFallback =
    env.GGTC_ALLOW_CLOUD_GANTT_EXPORT_FALLBACK !== "false";
  overrides.chartsDir = path.resolve(cwd, "charts");
  overrides.dbPath = path.resolve(cwd, resolveRuntimeTarget(env));
  overrides.ganttExportServerUrl = normalizeOptionalUrl(
    env.GGTC_GANTT_EXPORT_SERVER_URL,
  );
  overrides.runtimeSchemaSnapshotSubdir = resolveRuntimeSchemaSnapshotSubdir(env);

  if (env.GGTC_UNTRUSTED_ATTACHMENTS_DIR?.trim()) {
    const raw = env.GGTC_UNTRUSTED_ATTACHMENTS_DIR.trim();
    overrides.untrustedContentAttachmentsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_UNTRUSTED_ISSUE_COMMENTS_DIR?.trim()) {
    const raw = env.GGTC_UNTRUSTED_ISSUE_COMMENTS_DIR.trim();
    overrides.untrustedContentIssueCommentsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_UNTRUSTED_ISSUE_JOURNALS_DIR?.trim()) {
    const raw = env.GGTC_UNTRUSTED_ISSUE_JOURNALS_DIR.trim();
    overrides.untrustedContentIssueJournalsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_UNTRUSTED_PROJECT_JOURNALS_DIR?.trim()) {
    const raw = env.GGTC_UNTRUSTED_PROJECT_JOURNALS_DIR.trim();
    overrides.untrustedContentProjectJournalsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_UNTRUSTED_TASK_COMMENTS_DIR?.trim()) {
    const raw = env.GGTC_UNTRUSTED_TASK_COMMENTS_DIR.trim();
    overrides.untrustedContentTaskCommentsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_UNTRUSTED_TASK_JOURNALS_DIR?.trim()) {
    const raw = env.GGTC_UNTRUSTED_TASK_JOURNALS_DIR.trim();
    overrides.untrustedContentTaskJournalsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_SHARED_INSTANCE_UPLOADS_DIR?.trim()) {
    const raw = env.GGTC_SHARED_INSTANCE_UPLOADS_DIR.trim();
    overrides.sharedInstanceUploadsDir = path.isAbsolute(raw)
      ? raw
      : path.resolve(cwd, raw);
  }

  if (env.GGTC_MAX_ATTACHMENT_UPLOAD_BYTES) {
    const maxBytes = Number(env.GGTC_MAX_ATTACHMENT_UPLOAD_BYTES);
    if (Number.isFinite(maxBytes) && maxBytes > 0) {
      overrides.maxAttachmentUploadBytes = maxBytes;
    }
  }

  if (env.GGTC_MGR_UPLOADS_MAX_UPLOAD_BYTES?.trim()) {
    const maxBytes = Number(env.GGTC_MGR_UPLOADS_MAX_UPLOAD_BYTES.trim());
    if (Number.isFinite(maxBytes) && maxBytes > 0) {
      overrides.mgrUploadsMaxUploadBytes = maxBytes;
    }
  }

  if (env.GGTC_MAX_ATTACHMENTS_PER_ISSUE_OR_COMMENT) {
    const maxCount = Number(env.GGTC_MAX_ATTACHMENTS_PER_ISSUE_OR_COMMENT);
    if (Number.isFinite(maxCount) && maxCount > 0) {
      overrides.maxAttachmentsPerIssueOrComment = maxCount;
    }
  }

  if (env.GGTC_ALLOWED_ATTACHMENT_EXTENSIONS?.trim()) {
    const parsed = env.GGTC_ALLOWED_ATTACHMENT_EXTENSIONS.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
      .map((item) => (item.startsWith(".") ? item : `.${item}`));
    if (parsed.length > 0) {
      overrides.allowedAttachmentExtensions = parsed;
    }
  }

  if (env.GGTC_CREATE_DB_IF_MISSING) {
    overrides.createDbIfMissing = env.GGTC_CREATE_DB_IF_MISSING !== "false";
  }

  if (env.PORT) {
    const port = Number(env.PORT);
    if (Number.isFinite(port)) {
      overrides.port = port;
    }
  }

  if (env.HOST) {
    overrides.host = env.HOST;
  }

  if (env.GGTC_SESSION_TTL_MS) {
    const sessionTtlMs = Number(env.GGTC_SESSION_TTL_MS);
    if (Number.isFinite(sessionTtlMs)) {
      overrides.sessionTtlMs = sessionTtlMs;
    }
  }

  if (env.GGTC_TRUST_PROXY) {
    overrides.trustProxy = env.GGTC_TRUST_PROXY !== "false";
  }

  return buildBackendConfig(overrides);
}

function normalizeOptionalUrl(value: string | undefined): string | null {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
}
