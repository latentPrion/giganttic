import { Box, CircularProgress, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";

import { requestBlob } from "../../../../common/api/http-client.js";

const DEFAULT_ATTACHMENT_DOWNLOAD_NAME = "attachment";
const GIGANTT_URL_SCHEME = "gigantt:";

export interface DiscussionMarkdownAttachmentResolver {
  buildDownloadPath: (uriSuffix: string) => string | null;
  isAllowedInContext?: (uriSuffix: string) => boolean;
  prefix: string;
}

interface ResolvedMarkdownAttachment {
  downloadPath: string;
  uriSuffix: string;
}

interface DiscussionMarkdownImageProps {
  alt?: string;
  attachmentResolvers: DiscussionMarkdownAttachmentResolver[];
  src?: string;
  token: string;
}

interface DiscussionMarkdownRenderProps {
  attachmentResolvers: DiscussionMarkdownAttachmentResolver[];
  helpText?: string;
  markdown: string;
  showHelpText?: boolean;
  token: string;
}

function isAllowedMarkdownAttachment(
  resolver: DiscussionMarkdownAttachmentResolver,
  uriSuffix: string,
): boolean {
  return resolver.isAllowedInContext?.(uriSuffix) ?? true;
}

function resolveMarkdownAttachment(
  attachmentResolvers: DiscussionMarkdownAttachmentResolver[],
  href: string | undefined,
): ResolvedMarkdownAttachment | null {
  if (!href) {
    return null;
  }

  for (const resolver of attachmentResolvers) {
    if (!href.startsWith(resolver.prefix)) {
      continue;
    }

    const uriSuffix = href.slice(resolver.prefix.length);
    if (!uriSuffix || !isAllowedMarkdownAttachment(resolver, uriSuffix)) {
      return null;
    }

    const downloadPath = resolver.buildDownloadPath(uriSuffix);
    if (!downloadPath) {
      return null;
    }

    return { downloadPath, uriSuffix };
  }

  return null;
}

function transformMarkdownUrl(value: string): string {
  if (value.startsWith(GIGANTT_URL_SCHEME)) {
    return value;
  }

  return defaultUrlTransform(value);
}

function DiscussionMarkdownImage(props: DiscussionMarkdownImageProps) {
  const { alt, attachmentResolvers, src, token } = props;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const resolvedAttachment = resolveMarkdownAttachment(attachmentResolvers, src);
  const resolvedDownloadPath = resolvedAttachment?.downloadPath ?? null;

  useEffect(() => {
    if (!resolvedDownloadPath) {
      return undefined;
    }

    let active = true;
    let nextObjectUrl: string | null = null;
    setFailed(false);
    setObjectUrl(null);

    void (async () => {
      try {
        const blob = await requestBlob({
          path: resolvedDownloadPath,
          token,
        });
        nextObjectUrl = URL.createObjectURL(blob);
        if (active) {
          setObjectUrl(nextObjectUrl);
        }
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    })();

    return () => {
      active = false;
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [resolvedDownloadPath, token]);

  if (!resolvedDownloadPath) {
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
  resolvedAttachment: ResolvedMarkdownAttachment,
  filename: string,
): Promise<void> {
  const blob = await requestBlob({
    path: resolvedAttachment.downloadPath,
    token,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || DEFAULT_ATTACHMENT_DOWNLOAD_NAME;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderAttachmentLink(
  attachmentResolvers: DiscussionMarkdownAttachmentResolver[],
  token: string,
  children: React.ReactNode,
  href: string | undefined,
): React.ReactNode {
  const resolvedAttachment = resolveMarkdownAttachment(attachmentResolvers, href);
  if (!resolvedAttachment) {
    return <a href={href}>{children}</a>;
  }

  return (
    <button
      type="button"
      onClick={() =>
        void downloadDiscussionAttachment(
          token,
          resolvedAttachment,
          DEFAULT_ATTACHMENT_DOWNLOAD_NAME,
        )}
    >
      {children}
    </button>
  );
}

export function DiscussionMarkdownRender(props: DiscussionMarkdownRenderProps) {
  const {
    attachmentResolvers,
    helpText,
    markdown,
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
          a: ({ children, href }) =>
            renderAttachmentLink(attachmentResolvers, token, children, href),
          img: (imgProps) => (
            <DiscussionMarkdownImage
              alt={imgProps.alt}
              attachmentResolvers={attachmentResolvers}
              src={imgProps.src}
              token={token}
            />
          ),
        }}
        urlTransform={transformMarkdownUrl}
      >
        {markdown}
      </ReactMarkdown>
    </Box>
  );
}
