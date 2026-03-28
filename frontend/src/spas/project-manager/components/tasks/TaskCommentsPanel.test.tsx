import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { taskCommentsApi } from "../../api/task-comments-api.js";
import { TaskCommentsPanel } from "./TaskCommentsPanel.js";

vi.mock("../../api/task-comments-api.js", () => ({
  taskCommentsApi: {
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    deleteCommentAttachment: vi.fn(),
    listComments: vi.fn(),
    updateComment: vi.fn(),
    uploadCommentAttachment: vi.fn(),
  },
}));

const taskCommentsApiMock = vi.mocked(taskCommentsApi);

describe("TaskCommentsPanel", () => {
  beforeEach(() => {
    taskCommentsApiMock.createComment.mockReset();
    taskCommentsApiMock.deleteCommentAttachment.mockReset();
    taskCommentsApiMock.listComments.mockReset();
    taskCommentsApiMock.listComments.mockResolvedValue({
      comments: [
        {
          attachments: [],
          body: "Parent task comment",
          createdAt: "2026-03-10T00:00:00.000Z",
          createdByUserId: 2,
          id: 1,
          parentCommentId: null,
          taskId: "task-7",
          thumbsDownCount: 0,
          thumbsUpCount: 0,
          updatedAt: "2026-03-10T00:00:00.000Z",
        },
        {
          attachments: [{ byteLength: 222, id: "att-t-1", originalFilename: "child.png" }],
          body: "Child task comment",
          createdAt: "2026-03-10T00:01:00.000Z",
          createdByUserId: 3,
          id: 2,
          parentCommentId: 1,
          taskId: "task-7",
          thumbsDownCount: 0,
          thumbsUpCount: 0,
          updatedAt: "2026-03-10T00:01:00.000Z",
        },
      ],
    });
    taskCommentsApiMock.deleteCommentAttachment.mockResolvedValue({
      deletedAttachmentId: "att-t-1",
    });
    taskCommentsApiMock.createComment.mockResolvedValue({
      comment: {
        attachments: [],
        body: "A new task comment body",
        createdAt: "2026-03-10T00:02:00.000Z",
        createdByUserId: 999,
        id: 3,
        parentCommentId: null,
        taskId: "task-7",
        thumbsDownCount: 0,
        thumbsUpCount: 0,
        updatedAt: "2026-03-10T00:02:00.000Z",
      },
    });
  });

  it("posts a new task comment through the shared comments panel", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <TaskCommentsPanel
        currentUserId={999}
        highlightCommentId={null}
        onNavigateToComment={() => {}}
        projectId={42}
        taskId="task-7"
        taskTab="comments"
        token="pm-token"
      />,
    );

    await screen.findByText("Parent task comment");
    await user.type(screen.getByLabelText("New comment (markdown)"), "A new task comment body");
    await user.click(screen.getByRole("button", { name: "Post comment" }));

    await waitFor(() => {
      expect(taskCommentsApiMock.createComment).toHaveBeenCalledWith(
        "pm-token",
        42,
        "task-7",
        { body: "A new task comment body", parentCommentId: undefined },
      );
    });
  });

  it("deletes a task comment attachment and reloads comments", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <TaskCommentsPanel
        currentUserId={999}
        highlightCommentId={null}
        onNavigateToComment={() => {}}
        projectId={42}
        taskId="task-7"
        taskTab="comments"
        token="pm-token"
      />,
    );

    expect(await screen.findByText("child.png (222 bytes)")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(taskCommentsApiMock.deleteCommentAttachment).toHaveBeenCalledWith(
        "pm-token",
        42,
        "task-7",
        2,
        "att-t-1",
      );
    });
    expect(taskCommentsApiMock.listComments).toHaveBeenCalledTimes(2);
  });
});
