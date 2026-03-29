import React from "react";

import { issueAttachmentsApi } from "../../api/issue-attachments-api.js";
import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";
import { emitProjectManagerIssueDiscussionStateEvent } from "../../lib/issue-discussion-state-events.js";
import { DiscussionAttachmentsPanel } from "../discussion/DiscussionAttachmentsPanel.js";

interface IssueAttachmentsPanelProps {
  issueId: number;
  issueTab: string;
  projectId: number;
  sectionId?: string;
  token: string;
}

export function IssueAttachmentsPanel(props: IssueAttachmentsPanelProps) {
  const { issueId, issueTab, projectId, sectionId, token } = props;

  return (
    <DiscussionAttachmentsPanel
      api={{
        deleteAttachment: async (attachmentId) => {
          const response = await issueAttachmentsApi.deleteAttachment(
            token,
            projectId,
            issueId,
            attachmentId,
          );
          emitProjectManagerIssueDiscussionStateEvent({ issueId, projectId });
          return response;
        },
        listAttachments: async () =>
          issueAttachmentsApi.listAttachments(token, projectId, issueId),
        uploadAttachment: async (file) => {
          const response = await issueAttachmentsApi.uploadAttachment(
            token,
            projectId,
            issueId,
            file,
          );
          emitProjectManagerIssueDiscussionStateEvent({ issueId, projectId });
          return response;
        },
      }}
      emptyMessage="No issue-level attachments yet."
      isActive={issueTab === "attachments"}
      panelTitle="Issue-level attachments"
      resolveAttachmentDownloadPath={(attachmentId) =>
        createIssueAttachmentDownloadPath(projectId, issueId, attachmentId)}
      sectionId={sectionId}
      token={token}
    />
  );
}
