import React from "react";

import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { taskAttachmentsApi } from "../../api/task-attachments-api.js";
import { DiscussionAttachmentsPanel } from "../discussion/DiscussionAttachmentsPanel.js";

interface TaskAttachmentsPanelProps {
  projectId: number;
  taskId: string;
  taskTab: string;
  token: string;
}

export function TaskAttachmentsPanel(props: TaskAttachmentsPanelProps) {
  const { projectId, taskId, taskTab, token } = props;

  return (
    <DiscussionAttachmentsPanel
      api={{
        deleteAttachment: async (attachmentId) =>
          taskAttachmentsApi.deleteAttachment(token, projectId, taskId, attachmentId),
        listAttachments: async () =>
          taskAttachmentsApi.listAttachments(token, projectId, taskId),
        uploadAttachment: async (file) =>
          taskAttachmentsApi.uploadAttachment(token, projectId, taskId, file),
      }}
      emptyMessage="No task-level attachments yet."
      isActive={taskTab === "attachments"}
      panelTitle="Task-level attachments"
      resolveAttachmentDownloadPath={(attachmentId) =>
        createTaskAttachmentDownloadPath(projectId, taskId, attachmentId)}
      token={token}
    />
  );
}
