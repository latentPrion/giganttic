import React from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../common/api/api-error.js";
import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { projectAttachmentsApi } from "../../api/project-attachments-api.js";
import { ProjectAttachmentsPanel } from "./ProjectAttachmentsPanel.js";

vi.mock("../../api/project-attachments-api.js", () => ({
  projectAttachmentsApi: {
    deleteAttachment: vi.fn(),
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

const projectAttachmentsApiMock = vi.mocked(projectAttachmentsApi);

describe("ProjectAttachmentsPanel", () => {
  beforeEach(() => {
    projectAttachmentsApiMock.deleteAttachment.mockReset();
    projectAttachmentsApiMock.listAttachments.mockReset();
    projectAttachmentsApiMock.uploadAttachment.mockReset();
  });

  it("shows a friendly missing-attachments message instead of a raw API error", async () => {
    projectAttachmentsApiMock.listAttachments.mockRejectedValue(
      new ApiError("http", "HTTP 404", {
        responseBody: "Cannot GET attachments",
        status: 404,
      }),
    );

    renderWithTheme(
      <ProjectAttachmentsPanel
        isActive
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByText("No attachments exist for this project as yet.")).toBeVisible();
    expect(screen.queryByText("Cannot GET attachments")).not.toBeInTheDocument();
  });
});
