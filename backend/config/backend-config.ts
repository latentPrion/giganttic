import path from "node:path";

import {
  resolveRuntimeSchemaSnapshotSubdir,
  resolveRuntimeTarget,
} from "../../db/config.js";

const BYTE = 1;
const KIBIBYTE = 1024 * BYTE;
const MEBIBYTE = 1024 * KIBIBYTE;
const DEFAULT_MAX_ATTACHMENT_UPLOAD_BYTES = 5 * MEBIBYTE;
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
  maxAttachmentUploadBytes: number;
  maxAttachmentsPerIssueOrComment: number;
  port: number;
  routePrefix: string;
  runtimeSchemaSnapshotSubdir: string;
  sessionTtlMs: number;
  scopedSessionRouteAllowlist: ReadonlyArray<{
    method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    pattern: string;
  }>;
  untrustedContentAttachmentsDir: string;
  untrustedContentIssueCommentsDir: string;
}

export const BACKEND_CONFIG = Symbol("BACKEND_CONFIG");

function createDefaultUntrustedAttachmentsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "attachments");
}

function createDefaultUntrustedIssueCommentsDir(cwd: string): string {
  return path.join(cwd, "untrusted-content", "issue-comments");
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
    { method: "GET", pattern: "/projects/:projectId/chart" },
    { method: "PUT", pattern: "/projects/:projectId/chart" },
    { method: "GET", pattern: "/projects/:projectId/issues" },
    { method: "POST", pattern: "/projects/:projectId/issues" },
    { method: "GET", pattern: "/projects/:projectId/issues/:issueId" },
    { method: "PATCH", pattern: "/projects/:projectId/issues/:issueId" },
    { method: "DELETE", pattern: "/projects/:projectId/issues/:issueId" },
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
    maxAttachmentUploadBytes: DEFAULT_MAX_ATTACHMENT_UPLOAD_BYTES,
    maxAttachmentsPerIssueOrComment: DEFAULT_MAX_ATTACHMENTS_PER_ISSUE_OR_COMMENT,
    port: 3000,
    routePrefix: "stc-proj-mgmt/api",
    runtimeSchemaSnapshotSubdir: resolveRuntimeSchemaSnapshotSubdir(process.env),
    sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
    scopedSessionRouteAllowlist: createDefaultScopedSessionRouteAllowlist(),
    untrustedContentAttachmentsDir: createDefaultUntrustedAttachmentsDir(cwd),
    untrustedContentIssueCommentsDir: createDefaultUntrustedIssueCommentsDir(cwd),
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

  if (env.GGTC_MAX_ATTACHMENT_UPLOAD_BYTES) {
    const maxBytes = Number(env.GGTC_MAX_ATTACHMENT_UPLOAD_BYTES);
    if (Number.isFinite(maxBytes) && maxBytes > 0) {
      overrides.maxAttachmentUploadBytes = maxBytes;
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

  return buildBackendConfig(overrides);
}

function normalizeOptionalUrl(value: string | undefined): string | null {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
}
