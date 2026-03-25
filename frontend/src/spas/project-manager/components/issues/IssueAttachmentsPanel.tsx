import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";

import { requestBlob } from "../../../../common/api/http-client.js";
import { getApiErrorMessage } from "../../../../common/api/api-error.js";
import {
  createIssueAttachmentDownloadPath,
  issueAttachmentsApi,
} from "../../api/issue-attachments-api.js";
import type { IssueAttachmentSummary } from "../../contracts/issue-comments.contracts.js";

const FILE_INPUT_ACCEPT = "*/*";
const MIN_BYTES_LABEL = "0 B";

interface IssueAttachmentsPanelProps {
  issueId: number;
  issueTab: string;
  projectId: number;
  token: string;
}

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

export function IssueAttachmentsPanel(props: IssueAttachmentsPanelProps) {
  const { issueId, issueTab, projectId, token } = props;
  const [attachments, setAttachments] = useState<IssueAttachmentSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const response = await issueAttachmentsApi.listAttachments(token, projectId, issueId);
      setAttachments(response.attachments);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to load attachments."));
    } finally {
      setBusy(false);
    }
  }, [issueId, projectId, token]);

  useEffect(() => {
    if (issueTab !== "attachments") {
      return undefined;
    }

    void reload();

    return undefined;
  }, [issueTab, reload]);

  async function handleDownload(row: IssueAttachmentSummary): Promise<void> {
    setErrorMessage(null);
    try {
      const blob = await requestBlob({
        path: createIssueAttachmentDownloadPath(projectId, issueId, row.id),
        token,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = row.originalFilename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Download failed."));
    }
  }

  async function handleUpload(fileList: FileList | null): Promise<void> {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await issueAttachmentsApi.uploadAttachment(token, projectId, issueId, file);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  if (issueTab !== "attachments") {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Issue-level attachments</Typography>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Stack alignItems="flex-start" direction="row" spacing={2}>
        <Button component="label" disabled={busy} variant="outlined">
          Upload file
          <input
            accept={FILE_INPUT_ACCEPT}
            hidden
            onChange={(event) => void handleUpload(event.target.files)}
            type="file"
          />
        </Button>
        {busy ? <CircularProgress size={22} /> : null}
      </Stack>
      <List dense>
        {attachments.map((row) => (
          <ListItem key={row.id} disablePadding sx={{ py: 0.5 }}>
            <ListItemText
              primary={(
                <MuiLink
                  component="button"
                  onClick={() => void handleDownload(row)}
                  type="button"
                  underline="hover"
                >
                  {row.originalFilename}
                </MuiLink>
              )}
              secondary={formatByteLength(row.byteLength)}
            />
          </ListItem>
        ))}
      </List>
      {attachments.length === 0 && !busy ? (
        <Box>
          <Typography color="text.secondary" variant="body2">
            No issue-level attachments yet.
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}
