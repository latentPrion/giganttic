import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { issueCommentsApi } from "../../api/issue-comments-api.js";
import { IssueCommentsPanel } from "./IssueCommentsPanel.js";

vi.mock("../../api/issue-comments-api.js", () => ({
  issueCommentsApi: {
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    deleteCommentAttachment: vi.fn(),
    listComments: vi.fn(),
    updateComment: vi.fn(),
    uploadCommentAttachment: vi.fn(),
  },
}));

const issueCommentsApiMock = vi.mocked(issueCommentsApi);

describe("IssueCommentsPanel", () => {
  beforeEach(() => {
    issueCommentsApiMock.listComments.mockReset();
    issueCommentsApiMock.deleteCommentAttachment.mockReset();
    issueCommentsApiMock.listComments.mockResolvedValue({
      comments: [
        {
          attachments: [],
          body: "Parent comment seventeen",
          createdAt: "2026-03-10T00:00:00.000Z",
          createdByUserId: 2,
          id: 1,
          issueId: 7,
          parentCommentId: null,
          thumbsDownCount: 0,
          thumbsUpCount: 0,
          updatedAt: "2026-03-10T00:00:00.000Z",
        },
        {
          attachments: [{ byteLength: 111, id: "att-c-1", originalFilename: "child.png" }],
          body: "Child comment seventeen",
          createdAt: "2026-03-10T00:01:00.000Z",
          createdByUserId: 3,
          id: 2,
          issueId: 7,
          parentCommentId: 1,
          thumbsDownCount: 0,
          thumbsUpCount: 0,
          updatedAt: "2026-03-10T00:01:00.000Z",
        },
      ],
    });
    issueCommentsApiMock.deleteCommentAttachment.mockResolvedValue({
      deletedAttachmentId: "att-c-1",
    });
  });

  it("renders updated reply-chip wording", async () => {
    renderWithTheme(
      <IssueCommentsPanel
        currentUserId={999}
        highlightCommentId={null}
        issueId={7}
        issueTab="comments"
        onNavigateToComment={() => {}}
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByText(/Replying to comment/i)).toBeVisible();
  });

  it("deletes a comment attachment and reloads comments", async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <IssueCommentsPanel
        currentUserId={999}
        highlightCommentId={null}
        issueId={7}
        issueTab="comments"
        onNavigateToComment={() => {}}
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByText("child.png (111 bytes)")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(issueCommentsApiMock.deleteCommentAttachment).toHaveBeenCalledWith(
        "pm-token",
        42,
        7,
        2,
        "att-c-1",
      );
    });
    expect(issueCommentsApiMock.listComments).toHaveBeenCalledTimes(2);
  });
});

