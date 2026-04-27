import React from "react";

import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { taskAttachmentsApi } from "../../api/task-attachments-api.js";
import { emitProjectManagerTaskDiscussionStateEvent } from "../../lib/task-discussion-state-events.js";
import { DiscussionAttachmentsPanel } from "../discussion/DiscussionAttachmentsPanel.js";

interface TaskAttachmentsPanelProps {
  canManageAttachments?: boolean;
  chartId?: number;
  projectId: number;
  sectionId?: string;
  taskId: string;
  taskTab: string;
  token: string;
}

export function TaskAttachmentsPanel(props: TaskAttachmentsPanelProps) {
  const { canManageAttachments = true, chartId = 0, projectId, sectionId, taskId, taskTab, token } =
    props;

  return (
    <DiscussionAttachmentsPanel
      api={{
        deleteAttachment: async (attachmentId) => {
          const response = await taskAttachmentsApi.deleteAttachment(
            token,
            projectId,
            { chartId, taskId },
            attachmentId,
          );
          emitProjectManagerTaskDiscussionStateEvent({ projectId, taskId });
          return response;
        },
        listAttachments: async () =>
          taskAttachmentsApi.listAttachments(token, projectId, { chartId, taskId }),
        uploadAttachment: async (file) => {
          const response = await taskAttachmentsApi.uploadAttachment(
            token,
            projectId,
            { chartId, taskId },
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
        createTaskAttachmentDownloadPath(projectId, chartId, taskId, attachmentId)}
      sectionId={sectionId}
      token={token}
    />
  );
}
