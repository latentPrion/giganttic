import { describe, expect, it } from "vitest";

import {
  createProjectDetailRoute,
  createProjectIssueRoute,
  createProjectTaskRoute,
} from "./project-route-paths.js";
import { MGR_UPLOADS_ROUTE_PATH } from "../../../../../common/routes/app-route-paths.js";

describe("project route paths", () => {
  it("creates project detail routes with optional attachment-tab deep-link params", () => {
    expect(createProjectDetailRoute(42)).toBe("/pm/project?projectId=42");
    expect(createProjectDetailRoute(42, { tab: "attachments" })).toBe(
      "/pm/project?projectId=42&tab=attachments",
    );
    expect(
      createProjectDetailRoute(42, { attachmentId: "file-777", tab: "attachments" }),
    ).toBe("/pm/project?projectId=42&tab=attachments&attachmentId=file-777");
    expect(createProjectDetailRoute(42, { attachmentId: "file-777" })).toBe(
      "/pm/project?projectId=42&tab=attachments&attachmentId=file-777",
    );
  });

  it("creates issue detail routes with optional comment permalinks", () => {
    expect(createProjectIssueRoute(42, 7)).toBe("/pm/project/issue?projectId=42&id=7");
    expect(
      createProjectIssueRoute(42, 7, { commentId: 99, tab: "comments" }),
    ).toBe("/pm/project/issue?projectId=42&id=7&tab=comments&commentId=99");
  });

  it("exposes a global mgr-uploads SPA path without project scope", () => {
    expect(MGR_UPLOADS_ROUTE_PATH).toBe("/mgr-uploads");
  });

  it("creates task detail routes and encodes task ids safely", () => {
    expect(createProjectTaskRoute(42, "task-7")).toBe(
      "/pm/project/task?projectId=42&id=task-7&chartId=0",
    );
    expect(
      createProjectTaskRoute(42, "phase/one task", {
        commentId: 99,
        tab: "comments",
      }),
    ).toBe(
      "/pm/project/task?projectId=42&id=phase%2Fone+task&chartId=0&tab=comments&commentId=99",
    );
  });
});
