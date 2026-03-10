import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerProjectNavigation } from "./ProjectManagerProjectNavigation.js";

const navigateMock = vi.fn();

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
  });

  it("navigates to the other project-scoped PM routes while preserving projectId", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerProjectNavigation currentSection="detail" projectId={42} />,
    );

    await user.click(screen.getByRole("tab", { name: "Gantt" }));
    await user.click(screen.getByRole("tab", { name: "Issues" }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/pm/project/gantt?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/pm/project/issues?projectId=42");
  });

  it("disables project-scoped navigation when no project is selected", () => {
    renderWithTheme(
      <ProjectManagerProjectNavigation currentSection="issues" projectId={null} />,
    );

    expect(screen.getByRole("tab", { name: "Details" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Gantt" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Issues" })).toBeDisabled();
  });
});
