import React from "react";

import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { taskCommentsApi } from "../../api/task-comments-api.js";
import type { TaskComment } from "../../contracts/task-comments.contracts.js";
import { emitProjectManagerTaskDiscussionStateEvent } from "../../lib/task-discussion-state-events.js";
import { DiscussionCommentsPanel } from "../discussion/DiscussionCommentsPanel.js";
import { TASK_COMMENT_MARKDOWN_HELP_TEXT, TaskMarkdownRender } from "./TaskMarkdownRender.js";

interface TaskCommentsPanelProps {
  chartId?: number;
  canManageTaskDiscussion?: boolean;
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
    chartId = 0,
    onNavigateToComment,
    projectId,
    taskId,
    taskTab,
    token,
  } = props;

  return (
    <DiscussionCommentsPanel<TaskComment>
      api={{
        createComment: async (payload) => {
          const response = await taskCommentsApi.createComment(
            token,
            projectId,
            { chartId, taskId },
            payload,
          );
          emitProjectManagerTaskDiscussionStateEvent({ projectId, taskId });
          return response;
        },
        deleteComment: async (commentId) => {
          const response = await taskCommentsApi.deleteComment(
            token,
            projectId,
            { chartId, taskId },
            commentId,
          );
          emitProjectManagerTaskDiscussionStateEvent({ projectId, taskId });
          return response;
        },
        deleteCommentAttachment: async (commentId, attachmentId) =>
          taskCommentsApi.deleteCommentAttachment(
            token,
            projectId,
            { chartId, taskId },
            commentId,
            attachmentId,
          ),
        listComments: async () =>
          taskCommentsApi.listComments(token, projectId, { chartId, taskId }),
        updateComment: async (commentId, payload) =>
          taskCommentsApi.updateComment(
            token,
            projectId,
            { chartId, taskId },
            commentId,
            payload,
          ),
        uploadCommentAttachment: async (commentId, file) =>
          taskCommentsApi.uploadCommentAttachment(
            token,
            projectId,
            { chartId, taskId },
            commentId,
            file,
          ),
      }}
      commentDomIdPrefix="task-comment"
      canManageCommentAttachments={(comment) =>
        comment.createdByUserId === currentUserId || props.canManageTaskDiscussion === true}
      currentUserId={currentUserId}
      editorHelpText={TASK_COMMENT_MARKDOWN_HELP_TEXT}
      highlightCommentId={highlightCommentId}
      isActive={taskTab === "comments"}
      onNavigateToComment={onNavigateToComment}
      renderMarkdown={(markdown, context) => (
        <TaskMarkdownRender
          chartId={chartId}
          commentId={context?.commentId ?? null}
          markdown={markdown}
          projectId={projectId}
          taskId={taskId}
          token={token}
        />
      )}
      resolveAttachmentDownloadPath={(attachmentId) =>
        createTaskAttachmentDownloadPath(projectId, chartId, taskId, attachmentId)}
      token={token}
    />
  );
}
