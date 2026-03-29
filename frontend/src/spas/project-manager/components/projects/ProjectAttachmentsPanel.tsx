import React from "react";

import { createProjectAttachmentDownloadPath } from "../../api/project-attachment-paths.js";
import { projectAttachmentsApi } from "../../api/project-attachments-api.js";
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
        deleteAttachment: async (attachmentId) =>
          projectAttachmentsApi.deleteAttachment(token, projectId, attachmentId),
        listAttachments: async () =>
          projectAttachmentsApi.listAttachments(token, projectId),
        uploadAttachment: async (file) =>
          projectAttachmentsApi.uploadAttachment(token, projectId, file),
      }}
      emptyMessage="No project-level attachments yet."
      isActive={isActive}
      panelTitle="Project attachments"
      resolveAttachmentDownloadPath={(attachmentId) =>
        createProjectAttachmentDownloadPath(projectId, attachmentId)}
      token={token}
    />
  );
}
