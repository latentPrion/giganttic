import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../../../../common/api/api-error.js";
import { requestBlob } from "../../../../common/api/http-client.js";
import type { DiscussionAttachmentSummary } from "../../../../../../common/discussion/discussion.contracts.js";

const FILE_INPUT_ACCEPT = "*/*";
const MIN_BYTES_LABEL = "0 B";

function formatByteLength(byteLength: number): string {
  if (byteLength <= 0) {
    return MIN_BYTES_LABEL;
  }

  if (byteLength < 1024) {
    return `${byteLength} B`;
  }

  if (byteLength < 1024 * 1024) {
    return `${(byteLength / 1024).toFixed(1)} KiB`;
  }

  return `${(byteLength / (1024 * 1024)).toFixed(1)} MiB`;
}

async function downloadAttachment(
  token: string,
  resolveAttachmentDownloadPath: (attachmentId: string) => string,
  row: DiscussionAttachmentSummary,
): Promise<void> {
  const blob = await requestBlob({
    path: resolveAttachmentDownloadPath(row.id),
    token,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = row.originalFilename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface DiscussionAttachmentsPanelProps {
  api: {
    deleteAttachment: (attachmentId: string) => Promise<unknown>;
    listAttachments: () => Promise<{ attachments: DiscussionAttachmentSummary[] }>;
    uploadAttachment: (file: File) => Promise<unknown>;
  };
  emptyMessage: string;
  isActive: boolean;
  panelTitle: string;
  resolveAttachmentDownloadPath: (attachmentId: string) => string;
  token: string;
}

export function DiscussionAttachmentsPanel(props: DiscussionAttachmentsPanelProps) {
  const {
    api,
    emptyMessage,
    isActive,
    panelTitle,
    resolveAttachmentDownloadPath,
    token,
  } = props;
  const [attachments, setAttachments] = useState<DiscussionAttachmentSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const response = await api.listAttachments();
      setAttachments(response.attachments);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to load attachments."));
    } finally {
      setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    void reload();
    return undefined;
  }, [isActive, reload]);

  async function handleDelete(attachmentId: string): Promise<void> {
    setErrorMessage(null);
    setBusy(true);
    try {
      await api.deleteAttachment(attachmentId);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to delete attachment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(fileList: FileList | null): Promise<void> {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      for (const file of files) {
        await api.uploadAttachment(file);
      }
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!isActive) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{panelTitle}</Typography>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Paper sx={{ bgcolor: "action.hover", p: 2 }} variant="outlined">
        <Stack alignItems="flex-start" direction="row" spacing={2}>
          <Button component="label" disabled={busy} variant="outlined">
            Add attachment(s)
            <input
              accept={FILE_INPUT_ACCEPT}
              hidden
              multiple
              onChange={(event) => void handleUpload(event.target.files)}
              type="file"
            />
          </Button>
          {busy ? <CircularProgress size={22} /> : null}
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          Choose one or more files. Maximum size and allowed types are enforced on the server.
        </Typography>
      </Paper>
      <List dense>
        {attachments.map((row) => (
          <ListItem
            key={row.id}
            disablePadding
            sx={{ alignItems: "center", justifyContent: "space-between", py: 0.5 }}
          >
            <Button
              color="error"
              disabled={busy}
              onClick={() => void handleDelete(row.id)}
              size="small"
              variant="text"
            >
              Delete
            </Button>
            <ListItemText
              primary={(
                <MuiLink
                  component="button"
                  onClick={() =>
                    void downloadAttachment(token, resolveAttachmentDownloadPath, row)}
                  type="button"
                  underline="hover"
                >
                  {row.originalFilename}
                </MuiLink>
              )}
              primaryTypographyProps={{ align: "right" }}
              secondary={formatByteLength(row.byteLength)}
              secondaryTypographyProps={{ align: "right" }}
              sx={{ flex: "0 1 auto", textAlign: "right" }}
            />
          </ListItem>
        ))}
      </List>
      {attachments.length === 0 && !busy ? (
        <Box>
          <Typography color="text.secondary" variant="body2">
            {emptyMessage}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
