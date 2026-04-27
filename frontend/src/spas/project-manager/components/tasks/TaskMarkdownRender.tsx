import React from "react";

import { createProjectAttachmentDownloadPath } from "../../api/project-attachment-paths.js";
import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { createTaskCommentAttachmentDownloadPath } from "../../api/task-comment-attachment-paths.js";
import {
  createCommentAttachmentMarkdownHelpText,
  createJournalAttachmentMarkdownHelpText,
} from "../discussion/discussion-markdown-help.js";
import { DiscussionMarkdownRender } from "../discussion/DiscussionMarkdownRender.js";

export const GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX = "gigantt://project-attachment/";
export const GIGANTT_TASK_ATTACHMENT_URL_PREFIX = "gigantt://task-attachment/";
export const GIGANTT_TASK_COMMENT_ATTACHMENT_URL_PREFIX = "gigantt://task-comment-attachment/";

export const TASK_MARKDOWN_HELP_TEXT =
  createJournalAttachmentMarkdownHelpText([
    {
      idSourceLabel: "this project's Attachments tab",
      urlPrefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
    },
    {
      idSourceLabel: "this task's Attachments tab",
      urlPrefix: GIGANTT_TASK_ATTACHMENT_URL_PREFIX,
    },
  ]);

export const TASK_COMMENT_MARKDOWN_HELP_TEXT =
  createCommentAttachmentMarkdownHelpText({
    commentAttachmentUrlPrefix: GIGANTT_TASK_COMMENT_ATTACHMENT_URL_PREFIX,
    parentSources: [
      {
        idSourceLabel: "this project's Attachments tab",
        urlPrefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
      },
      {
        idSourceLabel: "this task's Attachments tab",
        urlPrefix: GIGANTT_TASK_ATTACHMENT_URL_PREFIX,
      },
    ],
  });

interface TaskMarkdownRenderProps {
  chartId?: number;
  commentId?: number | null;
  markdown: string;
  projectId: number;
  showHelpText?: boolean;
  taskId: string;
  token: string;
}

function parseTaskCommentAttachmentUriSuffix(
  uriSuffix: string,
): { attachmentId: string; commentId: number } | null {
  const [commentIdText, attachmentId] = uriSuffix.split("/");
  const commentId = Number(commentIdText);

  if (!commentIdText || !attachmentId || !Number.isInteger(commentId) || commentId <= 0) {
    return null;
  }

  return {
    attachmentId: decodeURIComponent(attachmentId),
    commentId,
  };
}

export function TaskMarkdownRender(props: TaskMarkdownRenderProps) {
  const {
    chartId = 0,
    commentId = null,
    markdown,
    projectId,
    showHelpText = false,
    taskId,
    token,
  } = props;

  return (
    <DiscussionMarkdownRender
      attachmentResolvers={[
        {
          buildDownloadPath: (attachmentId) =>
            createProjectAttachmentDownloadPath(projectId, attachmentId),
          prefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
        },
        {
          buildDownloadPath: (attachmentId) =>
            createTaskAttachmentDownloadPath(projectId, chartId, taskId, attachmentId),
          prefix: GIGANTT_TASK_ATTACHMENT_URL_PREFIX,
        },
        {
          buildDownloadPath: (uriSuffix) => {
            const parsed = parseTaskCommentAttachmentUriSuffix(uriSuffix);
            if (!parsed) {
              return null;
            }

            return createTaskCommentAttachmentDownloadPath(
              projectId,
              chartId,
              taskId,
              parsed.commentId,
              parsed.attachmentId,
            );
          },
          isAllowedInContext: (uriSuffix) => {
            const parsed = parseTaskCommentAttachmentUriSuffix(uriSuffix);
            return parsed !== null && commentId !== null && parsed.commentId === commentId;
          },
          prefix: GIGANTT_TASK_COMMENT_ATTACHMENT_URL_PREFIX,
        },
      ]}
      helpText={commentId === null ? TASK_MARKDOWN_HELP_TEXT : TASK_COMMENT_MARKDOWN_HELP_TEXT}
      markdown={markdown}
      showHelpText={showHelpText}
      token={token}
    />
  );
}
