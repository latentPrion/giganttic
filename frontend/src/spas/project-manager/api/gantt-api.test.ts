import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { ganttApi } from "./gantt-api.js";

const TEST_TOKEN = "test-token";
const CHART_XML = "<?xml version=\"1.0\"?><data/>";

function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}

function createTextResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
    status: 200,
    ...init,
  });
}

describe("ganttApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getProjectChartOrNull returns chart source on 200", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createTextResponse(CHART_XML),
    );

    const result = await ganttApi.getProjectChartOrNull(TEST_TOKEN, 55);

    expect(result).toEqual({ content: CHART_XML, type: "xml" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects/55/chart",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("getProjectChartOrNull returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not found", { status: 404 }),
    );

    const result = await ganttApi.getProjectChartOrNull(TEST_TOKEN, 55);

    expect(result).toBeNull();
  });

  it("getProjectChartOrNull rethrows non-404 HTTP errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Server error", { status: 500 }),
    );

    await expect(ganttApi.getProjectChartOrNull(TEST_TOKEN, 55)).rejects.toBeInstanceOf(ApiError);
  });

  it("putProjectChart sends JSON body and parses ok response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ ok: true }),
    );

    const result = await ganttApi.putProjectChart(TEST_TOKEN, 3, CHART_XML);

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects/3/chart",
      expect.objectContaining({
        body: JSON.stringify({ xml: CHART_XML }),
        method: "PUT",
      }),
    );
  });

  it("putProjectChart throws when client validation rejects empty xml", async () => {
    await expect(ganttApi.putProjectChart(TEST_TOKEN, 3, "")).rejects.toBeInstanceOf(ApiError);
  });
});
