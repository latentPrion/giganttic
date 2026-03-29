import React from "react";

import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";
import { DiscussionMarkdownRender } from "../discussion/DiscussionMarkdownRender.js";

export const GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX = "gigantt://issue-attachment/";

export const ISSUE_MARKDOWN_HELP_TEXT =
  "Embed issue attachments in markdown as ![alt](gigantt://issue-attachment/<attachmentId>) or link them the same way.";

interface IssueMarkdownRenderProps {
  issueId: number;
  markdown: string;
  projectId: number;
  showHelpText?: boolean;
  token: string;
}

export function IssueMarkdownRender(props: IssueMarkdownRenderProps) {
  const { issueId, markdown, projectId, showHelpText = false, token } = props;

  return (
    <DiscussionMarkdownRender
      attachmentUrlPrefix={GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX}
      helpText={ISSUE_MARKDOWN_HELP_TEXT}
      markdown={markdown}
      resolveAttachmentDownloadPath={(attachmentId) =>
        createIssueAttachmentDownloadPath(projectId, issueId, attachmentId)}
      showHelpText={showHelpText}
      token={token}
    />
  );
}
