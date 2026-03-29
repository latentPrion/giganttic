import React from "react";

import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";
import { createIssueCommentAttachmentDownloadPath } from "../../api/issue-comment-attachment-paths.js";
import { createProjectAttachmentDownloadPath } from "../../api/project-attachment-paths.js";
import {
  createCommentAttachmentMarkdownHelpText,
  createJournalAttachmentMarkdownHelpText,
} from "../discussion/discussion-markdown-help.js";
import { DiscussionMarkdownRender } from "../discussion/DiscussionMarkdownRender.js";

export const GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX = "gigantt://project-attachment/";
export const GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX = "gigantt://issue-attachment/";
export const GIGANTT_ISSUE_COMMENT_ATTACHMENT_URL_PREFIX = "gigantt://issue-comment-attachment/";

export const ISSUE_MARKDOWN_HELP_TEXT =
  createJournalAttachmentMarkdownHelpText([
    {
      idSourceLabel: "this project's Attachments tab",
      urlPrefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
    },
    {
      idSourceLabel: "this issue's Attachments tab",
      urlPrefix: GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX,
    },
  ]);

export const ISSUE_COMMENT_MARKDOWN_HELP_TEXT =
  createCommentAttachmentMarkdownHelpText({
    commentAttachmentUrlPrefix: GIGANTT_ISSUE_COMMENT_ATTACHMENT_URL_PREFIX,
    parentSources: [
      {
        idSourceLabel: "this project's Attachments tab",
        urlPrefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
      },
      {
        idSourceLabel: "this issue's Attachments tab",
        urlPrefix: GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX,
      },
    ],
  });

interface IssueMarkdownRenderProps {
  commentId?: number | null;
  issueId: number;
  markdown: string;
  projectId: number;
  showHelpText?: boolean;
  token: string;
}

function parseIssueCommentAttachmentUriSuffix(
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

export function IssueMarkdownRender(props: IssueMarkdownRenderProps) {
  const { commentId = null, issueId, markdown, projectId, showHelpText = false, token } = props;

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
            createIssueAttachmentDownloadPath(projectId, issueId, attachmentId),
          prefix: GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX,
        },
        {
          buildDownloadPath: (uriSuffix) => {
            const parsed = parseIssueCommentAttachmentUriSuffix(uriSuffix);
            if (!parsed) {
              return null;
            }

            return createIssueCommentAttachmentDownloadPath(
              projectId,
              issueId,
              parsed.commentId,
              parsed.attachmentId,
            );
          },
          isAllowedInContext: (uriSuffix) => {
            const parsed = parseIssueCommentAttachmentUriSuffix(uriSuffix);
            return parsed !== null && commentId !== null && parsed.commentId === commentId;
          },
          prefix: GIGANTT_ISSUE_COMMENT_ATTACHMENT_URL_PREFIX,
        },
      ]}
      helpText={commentId === null ? ISSUE_MARKDOWN_HELP_TEXT : ISSUE_COMMENT_MARKDOWN_HELP_TEXT}
      markdown={markdown}
      showHelpText={showHelpText}
      token={token}
    />
  );
}
