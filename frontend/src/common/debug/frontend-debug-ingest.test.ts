import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitFrontendDebugLog } from "./frontend-debug-ingest.js";

describe("emitFrontendDebugLog", () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response()));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("does nothing when debug ingest is disabled", () => {
    emitFrontendDebugLog(
      {
        data: { projectId: 4 },
        hypothesisId: "H1",
        location: "test.ts",
        message: "ignored",
        runId: "run-1",
      },
      {
        debugIngestEnabled: false,
        debugIngestUrl: "https://debug.example.com/ingest",
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when no debug ingest url is configured", () => {
    emitFrontendDebugLog(
      {
        data: { projectId: 4 },
        hypothesisId: "H1",
        location: "test.ts",
        message: "ignored",
        runId: "run-1",
      },
      {
        debugIngestEnabled: true,
        debugIngestUrl: null,
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the configured debug ingest url when enabled", () => {
    emitFrontendDebugLog(
      {
        data: { projectId: 4 },
        hypothesisId: "H1",
        location: "test.ts",
        message: "hello",
        runId: "run-1",
      },
      {
        debugIngestEnabled: true,
        debugIngestUrl: "https://debug.example.com/ingest",
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://debug.example.com/ingest",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "117825",
        }),
        method: "POST",
      }),
    );
  });
});

