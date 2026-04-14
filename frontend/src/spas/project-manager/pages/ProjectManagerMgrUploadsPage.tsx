import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import { MGR_UPLOADS_MAX_UPLOAD_MIB } from "../../../../../common/mgr-uploads/mgr-uploads.constants.js";
import type {
  MgrUploadFileEntry,
  MgrUploadsStorage,
} from "../../../../../common/mgr-uploads/mgr-uploads.contracts.js";
import { isApiError } from "../../../common/api/api-error.js";
import { mgrUploadsApi } from "../api/mgr-uploads-api.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { buildMgrUploadPublicFileUrl } from "../lib/build-mgr-upload-public-file-url.js";

/** Stable selector for routing/integration tests (`app-routing-mgr-uploads-route.test.tsx`). */
export const PROJECT_MANAGER_MGR_UPLOADS_PAGE_TEST_ID = "project-manager-mgr-uploads-page";

const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Shared instance uploads";
const FORBIDDEN_MESSAGE =
  "You do not have manager access to shared uploads. Effective project, team, or organization managers may use this section.";
const LOAD_ERROR_MESSAGE = "Could not load shared uploads. Try again later.";
const UPLOAD_INPUT_ID = "mgr-uploads-file-input";
const COPY_SUCCESS_FEEDBACK_MS = 2000;
const MAX_UPLOAD_HELP_TEXT = `Max file size: ${MGR_UPLOADS_MAX_UPLOAD_MIB} MiB per file.`;

interface ProjectManagerMgrUploadsPageProps {
  token: string;
}

type LoadState = "loading" | "ready" | "forbidden" | "error";

function formatByteLength(byteLength: number): string {
  if (byteLength < 1024) {
    return `${byteLength} B`;
  }
  if (byteLength < 1024 * 1024) {
    return `${(byteLength / 1024).toFixed(1)} KiB`;
  }
  return `${(byteLength / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatStorageSummary(storage: MgrUploadsStorage | null): string {
  if (!storage) {
    return "Available disk space: unavailable";
  }
  return `Available on ${storage.devicePath}: ${storage.availableBytes} bytes (${storage.availableMib.toFixed(2)} MiB)`;
}

function resolveLoadErrorKind(error: unknown): "forbidden" | "error" {
  if (isApiError(error) && error.kind === "http" && error.status === 403) {
    return "forbidden";
  }
  return "error";
}

export function ProjectManagerMgrUploadsPage(
  props: ProjectManagerMgrUploadsPageProps,
) {
  const [files, setFiles] = useState<MgrUploadFileEntry[]>([]);
  const [storage, setStorage] = useState<MgrUploadsStorage | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyFeedbackFilename, setCopyFeedbackFilename] = useState<string | null>(
    null,
  );

  const refreshFiles = useCallback(async () => {
    const response = await mgrUploadsApi.listFiles(props.token);
    setFiles(response.files);
    setStorage(response.storage);
  }, [props.token]);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    async function load(): Promise<void> {
      try {
        const response = await mgrUploadsApi.listFiles(props.token);
        if (!cancelled) {
          setFiles(response.files);
          setStorage(response.storage);
          setLoadState("ready");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadState(resolveLoadErrorKind(error));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [props.token]);

  async function handleUpload(fileList: FileList | null): Promise<void> {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setActionError(null);
    try {
      await mgrUploadsApi.uploadFile(props.token, file);
      await refreshFiles();
    } catch (error) {
      if (isApiError(error) && error.kind === "http" && error.status === 413) {
        setActionError(`File is too large (${MAX_UPLOAD_HELP_TEXT})`);
        return;
      }
      setActionError(
        isApiError(error) && error.kind === "http"
          ? `Upload failed (${error.status})`
          : "Upload failed",
      );
    }
  }

  async function handleDelete(filename: string): Promise<void> {
    setActionError(null);
    try {
      await mgrUploadsApi.deleteFile(props.token, filename);
      await refreshFiles();
    } catch (error) {
      setActionError(
        isApiError(error) && error.kind === "http"
          ? `Delete failed (${error.status})`
          : "Delete failed",
      );
    }
  }

  async function handleCopyUrl(filename: string): Promise<void> {
    const url = buildMgrUploadPublicFileUrl(filename);
    try {
      await navigator.clipboard.writeText(url);
      setCopyFeedbackFilename(filename);
      window.setTimeout(() => {
        setCopyFeedbackFilename((current) =>
          current === filename ? null : current
        );
      }, COPY_SUCCESS_FEEDBACK_MS);
    } catch {
      setActionError("Clipboard access was denied.");
    }
  }

  function renderBody(): React.ReactNode {
    if (loadState === "loading") {
      return (
        <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
          <CircularProgress size={32} />
          <Typography variant="body2">Loading shared uploads…</Typography>
        </Stack>
      );
    }

    if (loadState === "forbidden") {
      return <Alert severity="warning">{FORBIDDEN_MESSAGE}</Alert>;
    }

    if (loadState === "error") {
      return <Alert severity="error">{LOAD_ERROR_MESSAGE}</Alert>;
    }

    return (
      <Stack spacing={2}>
        {actionError ? <Alert severity="error">{actionError}</Alert> : null}
        <Stack alignItems="flex-start" spacing={1}>
          <Stack alignItems="flex-start" direction="row" spacing={2}>
            <Button component="label" htmlFor={UPLOAD_INPUT_ID} variant="contained">
              Upload file
            </Button>
            <input
              id={UPLOAD_INPUT_ID}
              hidden
              onChange={(event) => {
                void handleUpload(event.target.files);
                event.target.value = "";
              }}
              type="file"
            />
          </Stack>
          <Typography color="text.secondary" variant="body2">
            {MAX_UPLOAD_HELP_TEXT}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {formatStorageSummary(storage)}
          </Typography>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary" variant="body2">
                    No files uploaded yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              files.map((entry) => (
                <TableRow key={entry.name}>
                  <TableCell>{entry.name}</TableCell>
                  <TableCell align="right">
                    {formatByteLength(entry.sizeBytes)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={
                        copyFeedbackFilename === entry.name
                          ? "Copied"
                          : "Copy public URL"
                      }
                    >
                      <IconButton
                        aria-label={`Copy URL for ${entry.name}`}
                        onClick={() => {
                          void handleCopyUrl(entry.name);
                        }}
                        size="small"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete file">
                      <IconButton
                        aria-label={`Delete ${entry.name}`}
                        color="error"
                        onClick={() => {
                          void handleDelete(entry.name);
                        }}
                        size="small"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Stack>
    );
  }

  return (
    <Stack
      data-testid={PROJECT_MANAGER_MGR_UPLOADS_PAGE_TEST_ID}
      spacing={2}
      sx={{ p: 2 }}
    >
      <Box>
        <Typography color="text.secondary" variant="overline">
          {PAGE_OVERLINE}
        </Typography>
        <Typography component="h1" variant="h5">
          {PAGE_TITLE}
        </Typography>
      </Box>
      <ProjectManagerProjectNavigation
        authToken={props.token}
        currentSection="mgr-uploads"
        projectId={null}
      />
      {renderBody()}
    </Stack>
  );
}
