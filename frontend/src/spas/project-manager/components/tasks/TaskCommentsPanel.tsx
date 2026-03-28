import React from "react";

import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { taskCommentsApi } from "../../api/task-comments-api.js";
import type { TaskComment } from "../../contracts/task-comments.contracts.js";
import { DiscussionCommentsPanel } from "../discussion/DiscussionCommentsPanel.js";
import { TaskMarkdownRender } from "./TaskMarkdownRender.js";

interface TaskCommentsPanelProps {
  currentUserId: number;
  highlightCommentId: number | null;
  onNavigateToComment: (commentId: number) => void;
  projectId: number;
  taskId: string;
  taskTab: string;
  token: string;
}

export function TaskCommentsPanel(props: TaskCommentsPanelProps) {
  const {
    currentUserId,
    highlightCommentId,
    onNavigateToComment,
    projectId,
    taskId,
    taskTab,
    token,
  } = props;

  return (
    <DiscussionCommentsPanel<TaskComment>
      api={{
        createComment: async (payload) =>
          taskCommentsApi.createComment(token, projectId, taskId, payload),
        deleteComment: async (commentId) =>
          taskCommentsApi.deleteComment(token, projectId, taskId, commentId),
        deleteCommentAttachment: async (commentId, attachmentId) =>
          taskCommentsApi.deleteCommentAttachment(
            token,
            projectId,
            taskId,
            commentId,
            attachmentId,
          ),
        listComments: async () =>
          taskCommentsApi.listComments(token, projectId, taskId),
        updateComment: async (commentId, payload) =>
          taskCommentsApi.updateComment(token, projectId, taskId, commentId, payload),
        uploadCommentAttachment: async (commentId, file) =>
          taskCommentsApi.uploadCommentAttachment(
            token,
            projectId,
            taskId,
            commentId,
            file,
          ),
      }}
      commentDomIdPrefix="task-comment"
      currentUserId={currentUserId}
      highlightCommentId={highlightCommentId}
      isActive={taskTab === "comments"}
      onNavigateToComment={onNavigateToComment}
      renderMarkdown={(markdown) => (
        <TaskMarkdownRender
          markdown={markdown}
          projectId={projectId}
          taskId={taskId}
          token={token}
        />
      )}
      resolveAttachmentDownloadPath={(attachmentId) =>
        createTaskAttachmentDownloadPath(projectId, taskId, attachmentId)}
      token={token}
    />
  );
}
