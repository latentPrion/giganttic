import React from "react";

import { createProjectAttachmentDownloadPath } from "../../api/project-attachment-paths.js";
import { DiscussionMarkdownRender } from "../discussion/DiscussionMarkdownRender.js";

export const GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX = "gigantt://project-attachment/";

export const PROJECT_MARKDOWN_HELP_TEXT =
  "Embed project attachments in markdown as ![alt](gigantt://project-attachment/<attachmentId>) or link them the same way.";

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
      attachmentUrlPrefix={GIGANTT_PROJECT_ATTACHMENT_URL_PREFIX}
      helpText={PROJECT_MARKDOWN_HELP_TEXT}
      markdown={markdown}
      resolveAttachmentDownloadPath={(attachmentId) =>
        createProjectAttachmentDownloadPath(projectId, attachmentId)}
      showHelpText={showHelpText}
      token={token}
    />
  );
}
