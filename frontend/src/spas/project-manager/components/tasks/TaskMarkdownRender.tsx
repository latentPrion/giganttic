import React from "react";

import { createTaskAttachmentDownloadPath } from "../../api/task-attachment-paths.js";
import { DiscussionMarkdownRender } from "../discussion/DiscussionMarkdownRender.js";

export const GIGANTT_TASK_ATTACHMENT_URL_PREFIX = "gigantt://task-attachment/";

const HELP_TEXT =
  "Embed task attachments in markdown as ![alt](gigantt://task-attachment/<attachmentId>) or link them the same way.";

interface TaskMarkdownRenderProps {
  markdown: string;
  projectId: number;
  showHelpText?: boolean;
  taskId: string;
  token: string;
}

export function TaskMarkdownRender(props: TaskMarkdownRenderProps) {
  const { markdown, projectId, showHelpText = false, taskId, token } = props;

  return (
    <DiscussionMarkdownRender
      attachmentUrlPrefix={GIGANTT_TASK_ATTACHMENT_URL_PREFIX}
      helpText={HELP_TEXT}
      markdown={markdown}
      resolveAttachmentDownloadPath={(attachmentId) =>
        createTaskAttachmentDownloadPath(projectId, taskId, attachmentId)}
      showHelpText={showHelpText}
      token={token}
    />
  );
}
