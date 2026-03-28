import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { taskAttachmentsApi } from "../../api/task-attachments-api.js";
import { TaskAttachmentsPanel } from "./TaskAttachmentsPanel.js";

vi.mock("../../api/task-attachments-api.js", () => ({
  taskAttachmentsApi: {
    deleteAttachment: vi.fn(),
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

const taskAttachmentsApiMock = vi.mocked(taskAttachmentsApi);

describe("TaskAttachmentsPanel", () => {
  beforeEach(() => {
    taskAttachmentsApiMock.deleteAttachment.mockReset();
    taskAttachmentsApiMock.listAttachments.mockReset();
    taskAttachmentsApiMock.uploadAttachment.mockReset();
    taskAttachmentsApiMock.listAttachments.mockResolvedValue({
      attachments: [{ byteLength: 12, id: "att-1", originalFilename: "one.png" }],
    });
    taskAttachmentsApiMock.deleteAttachment.mockResolvedValue({
      deletedAttachmentId: "att-1",
    });
  });

  it("deletes a task attachment and reloads the list", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <TaskAttachmentsPanel
        projectId={42}
        taskId="task-7"
        taskTab="attachments"
        token="pm-token"
      />,
    );

    expect(await screen.findByText("one.png")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(taskAttachmentsApiMock.deleteAttachment).toHaveBeenCalledWith(
        "pm-token",
        42,
        "task-7",
        "att-1",
      );
    });
    expect(taskAttachmentsApiMock.listAttachments).toHaveBeenCalledTimes(2);
  });
});
