import React from "react";

import { createProjectAttachmentDownloadPath } from "../../api/project-attachment-paths.js";
import { createJournalAttachmentMarkdownHelpText } from "../discussion/discussion-markdown-help.js";
import { DiscussionMarkdownRender } from "../discussion/DiscussionMarkdownRender.js";

export const GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX = "gigantt://project-attachment/";

export const PROJECT_MARKDOWN_HELP_TEXT =
  createJournalAttachmentMarkdownHelpText([
    {
      idSourceLabel: "this project's Attachments tab",
      urlPrefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
    },
  ]);

interface ProjectMarkdownRenderProps {
  markdown: string;
  projectId: number;
  showHelpText?: boolean;
  token: string;
}

export function ProjectMarkdownRender(props: ProjectMarkdownRenderProps) {
  const { markdown, projectId, showHelpText = false, token } = props;

  return (
    <DiscussionMarkdownRender
      attachmentResolvers={[
        {
          buildDownloadPath: (attachmentId) =>
            createProjectAttachmentDownloadPath(projectId, attachmentId),
          prefix: GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX,
        },
      ]}
      helpText={PROJECT_MARKDOWN_HELP_TEXT}
      markdown={markdown}
      showHelpText={showHelpText}
      token={token}
    />
  );
}
