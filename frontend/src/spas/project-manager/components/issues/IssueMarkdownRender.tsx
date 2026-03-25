import { Box, CircularProgress, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { requestBlob } from "../../../../common/api/http-client.js";
import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";

export const GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX = "gigantt://issue-attachment/";

const HELP_TEXT =
  "Embed issue attachments in markdown as ![alt](gigantt://issue-attachment/<attachmentId>) or link them the same way.";

interface GiganttMarkdownImageProps {
  alt?: string;
  issueId: number;
  projectId: number;
  src?: string;
  token: string;
}

function GiganttMarkdownImage(props: GiganttMarkdownImageProps) {
  const { alt, issueId, projectId, src, token } = props;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src?.startsWith(GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX)) {
      return undefined;
    }

    const attachmentId = src.slice(GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX.length);
    let active = true;
    let revokedUrl: string | null = null;

    void (async () => {
      try {
        const blob = await requestBlob({
          path: createIssueAttachmentDownloadPath(projectId, issueId, attachmentId),
          token,
        });
        const nextUrl = URL.createObjectURL(blob);
        revokedUrl = nextUrl;
        if (active) {
          setObjectUrl(nextUrl);
        }
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    })();

    return () => {
      active = false;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [issueId, projectId, src, token]);

  if (!src?.startsWith(GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX)) {
    return <img alt={alt ?? ""} src={src} />;
  }

  if (failed) {
    return <Typography color="error" variant="body2">Unable to load image.</Typography>;
  }

  if (!objectUrl) {
    return <CircularProgress size={18} />;
  }

  return <img alt={alt ?? ""} src={objectUrl} />;
}

async function downloadIssueAttachment(
  token: string,
  projectId: number,
  issueId: number,
  attachmentId: string,
  filename: string,
): Promise<void> {
  const blob = await requestBlob({
    path: createIssueAttachmentDownloadPath(projectId, issueId, attachmentId),
    token,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "attachment";
  anchor.click();
  URL.revokeObjectURL(url);
}

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
    <Box sx={{ "& img": { maxWidth: "100%" } }}>
      {showHelpText ? (
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
          {HELP_TEXT}
        </Typography>
      ) : null}
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <Typography component="h1" sx={{ mt: 1, mb: 1 }} variant="h4">
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography component="h2" sx={{ mt: 1, mb: 1 }} variant="h5">
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography component="h3" sx={{ mt: 1, mb: 0.75 }} variant="h6">
              {children}
            </Typography>
          ),
          h4: ({ children }) => (
            <Typography component="h4" sx={{ mt: 1, mb: 0.75 }} variant="subtitle1">
              {children}
            </Typography>
          ),
          h5: ({ children }) => (
            <Typography component="h5" sx={{ mt: 0.75, mb: 0.5 }} variant="subtitle2">
              {children}
            </Typography>
          ),
          h6: ({ children }) => (
            <Typography component="h6" sx={{ mt: 0.75, mb: 0.5 }} variant="subtitle2">
              {children}
            </Typography>
          ),
          p: ({ children }) => (
            <Typography component="p" sx={{ mb: 1 }} variant="body1">
              {children}
            </Typography>
          ),
          a: ({ children, href }) => {
            if (href?.startsWith(GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX)) {
              const attachmentId = href.slice(GIGANTT_ISSUE_ATTACHMENT_URL_PREFIX.length);
              return (
                <button
                  type="button"
                  onClick={() =>
                    void downloadIssueAttachment(
                      token,
                      projectId,
                      issueId,
                      attachmentId,
                      "attachment",
                    )}
                >
                  {children}
                </button>
              );
            }
            return <a href={href}>{children}</a>;
          },
          img: (imgProps) => (
            <GiganttMarkdownImage
              alt={imgProps.alt}
              issueId={issueId}
              projectId={projectId}
              src={imgProps.src}
              token={token}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Box>
  );
}
