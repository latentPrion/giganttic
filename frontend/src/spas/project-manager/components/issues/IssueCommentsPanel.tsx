import React from "react";

import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";
import { issueCommentsApi } from "../../api/issue-comments-api.js";
import type { IssueComment } from "../../contracts/issue-comments.contracts.js";
import { DiscussionCommentsPanel } from "../discussion/DiscussionCommentsPanel.js";
import { IssueMarkdownRender } from "./IssueMarkdownRender.js";

interface IssueCommentsPanelProps {
  currentUserId: number;
  highlightCommentId: number | null;
  issueId: number;
  issueTab: string;
  onNavigateToComment: (commentId: number) => void;
  projectId: number;
  token: string;
}

export function IssueCommentsPanel(props: IssueCommentsPanelProps) {
  const {
    currentUserId,
    highlightCommentId,
    issueId,
    issueTab,
    onNavigateToComment,
    projectId,
    token,
  } = props;

  return (
    <DiscussionCommentsPanel<IssueComment>
      api={{
        createComment: async (payload) =>
          issueCommentsApi.createComment(token, projectId, issueId, payload),
        deleteComment: async (commentId) =>
          issueCommentsApi.deleteComment(token, projectId, issueId, commentId),
        deleteCommentAttachment: async (commentId, attachmentId) =>
          issueCommentsApi.deleteCommentAttachment(
            token,
            projectId,
            issueId,
            commentId,
            attachmentId,
          ),
        listComments: async () =>
          issueCommentsApi.listComments(token, projectId, issueId),
        updateComment: async (commentId, payload) =>
          issueCommentsApi.updateComment(token, projectId, issueId, commentId, payload),
        uploadCommentAttachment: async (commentId, file) =>
          issueCommentsApi.uploadCommentAttachment(
            token,
            projectId,
            issueId,
            commentId,
            file,
          ),
      }}
      commentDomIdPrefix="issue-comment"
      currentUserId={currentUserId}
      highlightCommentId={highlightCommentId}
      isActive={issueTab === "comments"}
      onNavigateToComment={onNavigateToComment}
      renderMarkdown={(markdown) => (
        <IssueMarkdownRender
          issueId={issueId}
          markdown={markdown}
          projectId={projectId}
          token={token}
        />
      )}
      resolveAttachmentDownloadPath={(attachmentId) =>
        createIssueAttachmentDownloadPath(projectId, issueId, attachmentId)}
      token={token}
    />
  );
}
