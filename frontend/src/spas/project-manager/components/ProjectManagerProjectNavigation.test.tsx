import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { useMgrUploadsTabVisibility } from "../hooks/use-mgr-uploads-tab-visibility.js";
import { ProjectManagerProjectNavigation } from "./ProjectManagerProjectNavigation.js";

const navigateMock = vi.fn();
const TEST_AUTH_TOKEN = "test-auth-token";

vi.mock("../hooks/use-mgr-uploads-tab-visibility.js", () => ({
  useMgrUploadsTabVisibility: vi.fn(() => "forbidden"),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("ProjectManagerProjectNavigation", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(useMgrUploadsTabVisibility).mockReturnValue("forbidden");
  });

  it("navigates to mgr-uploads when the shared uploads tab is visible", async () => {
    const user = userEvent.setup();
    vi.mocked(useMgrUploadsTabVisibility).mockReturnValue("allowed");

    renderWithTheme(
      <ProjectManagerProjectNavigation
        authToken={TEST_AUTH_TOKEN}
        currentSection="detail"
        projectId={42}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Shared uploads" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/pm/mgr-uploads");
  });

  it("navigates to the other project-scoped PM routes while preserving projectId", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectNavigation
        authToken={TEST_AUTH_TOKEN}
        currentSection="detail"
        projectId={42}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Gantt" }));
    await user.click(screen.getByRole("tab", { name: "Kanban Board" }));
    await user.click(screen.getByRole("tab", { name: "Issues" }));
    await user.click(screen.getByRole("tab", { name: "Tasks" }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/pm/pm/project/gantt?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/pm/pm/project/kanban?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(3, "/pm/pm/project/issues?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(4, "/pm/pm/project/tasks?projectId=42");
  });

  it("disables project-scoped navigation when no project is selected", () => {
    renderWithTheme(
      <ProjectManagerProjectNavigation
        authToken={TEST_AUTH_TOKEN}
        currentSection="issues"
        projectId={null}
      />,
    );

    expect(screen.getByRole("tab", { name: "Details" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Gantt" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Kanban Board" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Issues" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Tasks" })).toBeDisabled();
  });

  it("navigates to global mgr-uploads from Shared uploads without a project", async () => {
    const user = userEvent.setup();
    vi.mocked(useMgrUploadsTabVisibility).mockReturnValue("allowed");

    renderWithTheme(
      <ProjectManagerProjectNavigation
        authToken={TEST_AUTH_TOKEN}
        currentSection="issues"
        projectId={null}
      />,
    );

    const sharedTab = screen.getByRole("tab", { name: "Shared uploads" });
    expect(sharedTab).toBeEnabled();
    await user.click(sharedTab);
    expect(navigateMock).toHaveBeenCalledWith("/pm/pm/mgr-uploads");
  });

  it("renders optional right-side actions alongside the project tabs", () => {
    renderWithTheme(
      <ProjectManagerProjectNavigation
        actions={<button type="button">Download XML</button>}
        authToken={TEST_AUTH_TOKEN}
        currentSection="gantt"
        projectId={42}
      />,
    );

    expect(screen.getByRole("tab", { name: "Details" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Download XML" })).toBeVisible();
  });

  it("renders and closes the task detail tab back to the tasks list", async () => {
    const user = userEvent.setup();
    const onCloseTaskTab = vi.fn();

    renderWithTheme(
      <ProjectManagerProjectNavigation
        authToken={TEST_AUTH_TOKEN}
        currentSection="task-detail"
        projectId={42}
        taskDetailContext={{ onCloseTaskTab, taskId: "task-7" }}
      />,
    );

    expect(screen.getByRole("tab", { name: /Task task-7/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Close task task-7 tab/i }));

    expect(onCloseTaskTab).toHaveBeenCalledTimes(1);
  });
});
