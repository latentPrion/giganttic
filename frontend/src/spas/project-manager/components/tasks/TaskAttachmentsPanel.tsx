import React from "react";

import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { taskAttachmentsApi } from "../../api/task-attachments-api.js";
import { emitProjectManagerTaskDiscussionStateEvent } from "../../lib/task-discussion-state-events.js";
import { DiscussionAttachmentsPanel } from "../discussion/DiscussionAttachmentsPanel.js";

interface TaskAttachmentsPanelProps {
  canManageAttachments?: boolean;
  projectId: number;
  sectionId?: string;
  taskId: string;
  taskTab: string;
  token: string;
}

export function TaskAttachmentsPanel(props: TaskAttachmentsPanelProps) {
  const { canManageAttachments = true, projectId, sectionId, taskId, taskTab, token } = props;

  return (
    <DiscussionAttachmentsPanel
      api={{
        deleteAttachment: async (attachmentId) => {
          const response = await taskAttachmentsApi.deleteAttachment(
            token,
            projectId,
            taskId,
            attachmentId,
          );
          emitProjectManagerTaskDiscussionStateEvent({ projectId, taskId });
          return response;
        },
        listAttachments: async () =>
          taskAttachmentsApi.listAttachments(token, projectId, taskId),
        uploadAttachment: async (file) => {
          const response = await taskAttachmentsApi.uploadAttachment(
            token,
            projectId,
            taskId,
            file,
          );
          emitProjectManagerTaskDiscussionStateEvent({ projectId, taskId });
          return response;
        },
      }}
      canManageAttachments={canManageAttachments}
      emptyMessage="No task-level attachments yet."
      isActive={taskTab === "attachments"}
      panelTitle="Task-level attachments"
      resolveAttachmentDownloadPath={(attachmentId) =>
        createTaskAttachmentDownloadPath(projectId, taskId, attachmentId)}
      sectionId={sectionId}
      token={token}
    />
  );
}
