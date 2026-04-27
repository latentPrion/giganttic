import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
        { chartId: 0, taskId: "task-7" },
        "att-1",
      );
    });
    expect(taskAttachmentsApiMock.listAttachments).toHaveBeenCalledTimes(2);
  });

  it("allows uploading the first task attachment from an empty task discussion", async () => {
    const user = userEvent.setup();
    taskAttachmentsApiMock.listAttachments.mockResolvedValue({ attachments: [] });
    taskAttachmentsApiMock.uploadAttachment.mockResolvedValue({
      attachment: { byteLength: 12, id: "att-2", originalFilename: "first.png" },
    });

    const view = renderWithTheme(
      <TaskAttachmentsPanel
        projectId={42}
        taskId="task-7"
        taskTab="attachments"
        token="pm-token"
      />,
    );

    const input = view.container.querySelector("input[type='file']");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected file input to be rendered");
    }

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([137, 80, 78, 71])], "first.png", {
            type: "image/png",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(taskAttachmentsApiMock.uploadAttachment).toHaveBeenCalledWith(
        "pm-token",
        42,
        { chartId: 0, taskId: "task-7" },
        expect.any(File),
      );
    });
  });

  it("shows the max file size message in the task attachment upload area", async () => {
    renderWithTheme(
      <TaskAttachmentsPanel
        projectId={42}
        taskId="task-7"
        taskTab="attachments"
        token="pm-token"
      />,
    );

    expect(await screen.findByText(/Max file size: 5\.0 MiB per file\./i)).toBeVisible();
  });

  it("shows the attachment id in the task attachment list", async () => {
    renderWithTheme(
      <TaskAttachmentsPanel
        projectId={42}
        taskId="task-7"
        taskTab="attachments"
        token="pm-token"
      />,
    );

    expect(await screen.findByText("ID: att-1 • 12 B")).toBeVisible();
  });

  it("hides upload and delete controls when attachment management is disabled", async () => {
    renderWithTheme(
      <TaskAttachmentsPanel
        canManageAttachments={false}
        projectId={42}
        taskId="task-7"
        taskTab="attachments"
        token="pm-token"
      />,
    );

    expect(await screen.findByText("one.png")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add attachment(s)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
