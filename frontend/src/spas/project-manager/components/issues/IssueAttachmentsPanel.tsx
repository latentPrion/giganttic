import React from "react";

import { issueAttachmentsApi } from "../../api/issue-attachments-api.js";
import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";
import { DiscussionAttachmentsPanel } from "../discussion/DiscussionAttachmentsPanel.js";

interface IssueAttachmentsPanelProps {
  issueId: number;
  issueTab: string;
  projectId: number;
  token: string;
}

export function IssueAttachmentsPanel(props: IssueAttachmentsPanelProps) {
  const { issueId, issueTab, projectId, token } = props;

  return (
    <DiscussionAttachmentsPanel
      api={{
        deleteAttachment: async (attachmentId) =>
          issueAttachmentsApi.deleteAttachment(token, projectId, issueId, attachmentId),
        listAttachments: async () =>
          issueAttachmentsApi.listAttachments(token, projectId, issueId),
        uploadAttachment: async (file) =>
          issueAttachmentsApi.uploadAttachment(token, projectId, issueId, file),
      }}
      emptyMessage="No issue-level attachments yet."
      isActive={issueTab === "attachments"}
      panelTitle="Issue-level attachments"
      resolveAttachmentDownloadPath={(attachmentId) =>
        createIssueAttachmentDownloadPath(projectId, issueId, attachmentId)}
      token={token}
    />
  );
}
