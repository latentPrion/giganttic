import { frontendConfig, type FrontendConfig } from "../../config/frontend-config.js";

const DEFAULT_DEBUG_SESSION_ID = "117825";

interface FrontendDebugLogPayload {
  data: Record<string, unknown>;
  hypothesisId: string;
  location: string;
  message: string;
  runId: string;
}

type FrontendDebugIngestConfig = Pick<
  FrontendConfig,
  "debugIngestEnabled" | "debugIngestUrl"
>;

function createRequestHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": DEFAULT_DEBUG_SESSION_ID,
  };
}

function buildRequestBody(payload: FrontendDebugLogPayload): string {
  return JSON.stringify({
    data: payload.data,
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    runId: payload.runId,
    sessionId: DEFAULT_DEBUG_SESSION_ID,
    timestamp: Date.now(),
  });
}

function resolveDebugIngestUrl(
  config: FrontendDebugIngestConfig,
): string | null {
  if (!config.debugIngestEnabled) {
    return null;
  }

  return config.debugIngestUrl;
}

export function emitFrontendDebugLog(
  payload: FrontendDebugLogPayload,
  config: FrontendDebugIngestConfig = frontendConfig,
): void {
  const debugIngestUrl = resolveDebugIngestUrl(config);
  if (!debugIngestUrl) {
    return;
  }

  fetch(debugIngestUrl, {
    body: buildRequestBody(payload),
    headers: createRequestHeaders(),
    method: "POST",
  }).catch(() => {});
}

