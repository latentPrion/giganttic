import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { issueAttachmentsApi } from "../../api/issue-attachments-api.js";
import { IssueAttachmentsPanel } from "./IssueAttachmentsPanel.js";

vi.mock("../../api/issue-attachments-api.js", () => ({
  createIssueAttachmentDownloadPath: vi.fn((projectId: number, issueId: number, attachmentId: string) =>
    `/projects/${projectId}/issues/${issueId}/attachments/${attachmentId}/download`),
  issueAttachmentsApi: {
    deleteAttachment: vi.fn(),
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

const issueAttachmentsApiMock = vi.mocked(issueAttachmentsApi);

describe("IssueAttachmentsPanel", () => {
  beforeEach(() => {
    issueAttachmentsApiMock.listAttachments.mockReset();
    issueAttachmentsApiMock.uploadAttachment.mockReset();
    issueAttachmentsApiMock.deleteAttachment.mockReset();
    issueAttachmentsApiMock.listAttachments.mockResolvedValue({
      attachments: [{ byteLength: 12, id: "att-1", originalFilename: "one.png" }],
    });
    issueAttachmentsApiMock.deleteAttachment.mockResolvedValue({
      deletedAttachmentId: "att-1",
    });
  });

  it("deletes an attachment and reloads list", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <IssueAttachmentsPanel
        issueId={7}
        issueTab="attachments"
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByText("one.png")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(issueAttachmentsApiMock.deleteAttachment).toHaveBeenCalledWith(
        "pm-token",
        42,
        7,
        "att-1",
      );
    });
    expect(issueAttachmentsApiMock.listAttachments).toHaveBeenCalledTimes(2);
  });
});

