import { Box, CircularProgress, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { requestBlob } from "../../../../common/api/http-client.js";

interface DiscussionMarkdownImageProps {
  alt?: string;
  resolveAttachmentDownloadPath: (attachmentId: string) => string;
  src?: string;
  token: string;
  urlPrefix: string;
}

function DiscussionMarkdownImage(props: DiscussionMarkdownImageProps) {
  const { alt, resolveAttachmentDownloadPath, src, token, urlPrefix } = props;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src?.startsWith(urlPrefix)) {
      return undefined;
    }

    const attachmentId = src.slice(urlPrefix.length);
    let active = true;
    let revokedUrl: string | null = null;

    void (async () => {
      try {
        const blob = await requestBlob({
          path: resolveAttachmentDownloadPath(attachmentId),
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
  }, [resolveAttachmentDownloadPath, src, token, urlPrefix]);

  if (!src?.startsWith(urlPrefix)) {
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

async function downloadDiscussionAttachment(
  token: string,
  resolveAttachmentDownloadPath: (attachmentId: string) => string,
  attachmentId: string,
  filename: string,
): Promise<void> {
  const blob = await requestBlob({
    path: resolveAttachmentDownloadPath(attachmentId),
    token,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "attachment";
  anchor.click();
  URL.revokeObjectURL(url);
}

interface DiscussionMarkdownRenderProps {
  attachmentUrlPrefix: string;
  helpText?: string;
  markdown: string;
  resolveAttachmentDownloadPath: (attachmentId: string) => string;
  showHelpText?: boolean;
  token: string;
}

export function DiscussionMarkdownRender(props: DiscussionMarkdownRenderProps) {
  const {
    attachmentUrlPrefix,
    helpText,
    markdown,
    resolveAttachmentDownloadPath,
    showHelpText = false,
    token,
  } = props;

  return (
    <Box sx={{ "& img": { maxWidth: "100%" } }}>
      {showHelpText && helpText ? (
        <Typography color="text.secondary" sx={{ mb: 1 }} variant="caption">
          {helpText}
        </Typography>
      ) : null}
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <Typography component="h1" sx={{ mb: 1, mt: 1 }} variant="h4">
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography component="h2" sx={{ mb: 1, mt: 1 }} variant="h5">
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography component="h3" sx={{ mb: 0.75, mt: 1 }} variant="h6">
              {children}
            </Typography>
          ),
          h4: ({ children }) => (
            <Typography component="h4" sx={{ mb: 0.75, mt: 1 }} variant="subtitle1">
              {children}
            </Typography>
          ),
          h5: ({ children }) => (
            <Typography component="h5" sx={{ mb: 0.5, mt: 0.75 }} variant="subtitle2">
              {children}
            </Typography>
          ),
          h6: ({ children }) => (
            <Typography component="h6" sx={{ mb: 0.5, mt: 0.75 }} variant="subtitle2">
              {children}
            </Typography>
          ),
          p: ({ children }) => (
            <Typography component="p" sx={{ mb: 1 }} variant="body1">
              {children}
            </Typography>
          ),
          a: ({ children, href }) => {
            if (href?.startsWith(attachmentUrlPrefix)) {
              const attachmentId = href.slice(attachmentUrlPrefix.length);
              return (
                <button
                  type="button"
                  onClick={() =>
                    void downloadDiscussionAttachment(
                      token,
                      resolveAttachmentDownloadPath,
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
            <DiscussionMarkdownImage
              alt={imgProps.alt}
              resolveAttachmentDownloadPath={resolveAttachmentDownloadPath}
              src={imgProps.src}
              token={token}
              urlPrefix={attachmentUrlPrefix}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Box>
  );
}
