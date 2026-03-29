import React from "react";

import { createProjectAttachmentDownloadPath } from "../../api/project-attachment-paths.js";
import { projectAttachmentsApi } from "../../api/project-attachments-api.js";
import { emitProjectManagerProjectAttachmentStateEvent } from "../../lib/project-attachment-state-events.js";
import { DiscussionAttachmentsPanel } from "../discussion/DiscussionAttachmentsPanel.js";

interface ProjectAttachmentsPanelProps {
  isActive: boolean;
  projectId: number;
  token: string;
}

export function ProjectAttachmentsPanel(props: ProjectAttachmentsPanelProps) {
  const { isActive, projectId, token } = props;

  return (
    <DiscussionAttachmentsPanel
      api={{
        deleteAttachment: async (attachmentId) => {
          const response = await projectAttachmentsApi.deleteAttachment(
            token,
            projectId,
            attachmentId,
          );
          emitProjectManagerProjectAttachmentStateEvent({ projectId });
          return response;
        },
        listAttachments: async () =>
          projectAttachmentsApi.listAttachments(token, projectId),
        uploadAttachment: async (file) => {
          const response = await projectAttachmentsApi.uploadAttachment(
            token,
            projectId,
            file,
          );
          emitProjectManagerProjectAttachmentStateEvent({ projectId });
          return response;
        },
      }}
      emptyMessage="No project-level attachments yet."
      isActive={isActive}
      notFoundMessage="No attachments exist for this project as yet."
      panelTitle="Project attachments"
      resolveAttachmentDownloadPath={(attachmentId) =>
        createProjectAttachmentDownloadPath(projectId, attachmentId)}
      token={token}
    />
  );
}
