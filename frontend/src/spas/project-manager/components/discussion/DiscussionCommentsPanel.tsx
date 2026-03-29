import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../../../../common/api/api-error.js";
import { requestBlob } from "../../../../common/api/http-client.js";
import {
  createDiscussionMaxFileSizeMessage,
  formatDiscussionByteLength,
} from "../../../../../../common/discussion/discussion-upload.constants.js";
import {
  COMMENT_BODY_MIN_LENGTH,
  type CreateDiscussionCommentRequest,
  type DiscussionAttachmentSummary,
  type UpdateDiscussionCommentRequest,
} from "../../../../../../common/discussion/discussion.contracts.js";

const COMMENT_ATTACHMENT_MAX_FILE_SIZE_MESSAGE = createDiscussionMaxFileSizeMessage();
const COMMENT_ATTACHMENT_ID_LABEL_PREFIX = "ID: ";
const COMMENT_ATTACHMENT_METADATA_SEPARATOR = " • ";

function createCommentAttachmentMetadataLabel(
  attachment: DiscussionAttachmentSummary,
): string {
  return `${COMMENT_ATTACHMENT_ID_LABEL_PREFIX}${attachment.id}${COMMENT_ATTACHMENT_METADATA_SEPARATOR}${formatDiscussionByteLength(attachment.byteLength)}`;
}

export interface DiscussionCommentLike {
  attachments: DiscussionAttachmentSummary[];
  body: string;
  createdAt: string;
  createdByUserId: number;
  id: number;
  parentCommentId: number | null;
  thumbsDownCount: number;
  thumbsUpCount: number;
}

interface DiscussionCommentsPanelProps<Comment extends DiscussionCommentLike> {
  api: {
    createComment: (payload: CreateDiscussionCommentRequest) => Promise<unknown>;
    deleteComment: (commentId: number) => Promise<unknown>;
    deleteCommentAttachment: (
      commentId: number,
      attachmentId: string,
    ) => Promise<unknown>;
    listComments: () => Promise<{ comments: Comment[] }>;
    updateComment: (
      commentId: number,
      payload: UpdateDiscussionCommentRequest,
    ) => Promise<unknown>;
    uploadCommentAttachment: (commentId: number, file: File) => Promise<unknown>;
  };
  commentDomIdPrefix: string;
  currentUserId: number;
  editorHelpText: string;
  highlightCommentId: number | null;
  isActive: boolean;
  onNavigateToComment: (commentId: number) => void;
  panelTitle?: string;
  renderMarkdown: (
    markdown: string,
    context?: { commentId: number },
  ) => React.ReactNode;
  resolveAttachmentDownloadPath: (attachmentId: string) => string;
  token: string;
}

function findCommentById<Comment extends DiscussionCommentLike>(
  comments: Comment[],
  commentId: number,
): Comment | undefined {
  return comments.find((row) => row.id === commentId);
}

function createReplyChipLabel(commentId: number): string {
  return `Replying to comment #${commentId}`;
}

async function downloadAttachment(
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
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function CommentAttachmentsList(props: {
  onDelete: (attachmentId: string) => void;
  onDownload: (attachmentId: string, filename: string) => void;
  rows: DiscussionAttachmentSummary[];
}) {
  if (props.rows.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.5} sx={{ mt: 1, width: "100%" }}>
      <Typography color="text.secondary" variant="caption">
        Attachments
      </Typography>
      {props.rows.map((attachment) => (
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          key={attachment.id}
        >
          <Button
            color="error"
            onClick={() => props.onDelete(attachment.id)}
            size="small"
            type="button"
            variant="text"
          >
            Delete
          </Button>
          <Box sx={{ flex: "1 1 auto", textAlign: "right" }}>
            <MuiLink
              component="button"
              onClick={() =>
                props.onDownload(attachment.id, attachment.originalFilename)}
              type="button"
              underline="hover"
              sx={{ textAlign: "right" }}
            >
              {attachment.originalFilename}
            </MuiLink>
            <Typography
              color="text.secondary"
              sx={{ display: "block", mt: 0.25 }}
              variant="caption"
            >
              {createCommentAttachmentMetadataLabel(attachment)}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export function DiscussionCommentsPanel<Comment extends DiscussionCommentLike>(
  props: DiscussionCommentsPanelProps<Comment>,
) {
  const {
    api,
    commentDomIdPrefix,
    currentUserId,
    editorHelpText,
    highlightCommentId,
    isActive,
    onNavigateToComment,
    panelTitle = "Comments",
    renderMarkdown,
    resolveAttachmentDownloadPath,
    token,
  } = props;

  const [comments, setComments] = useState<Comment[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composerBody, setComposerBody] = useState("");
  const [parentCommentId, setParentCommentId] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const reload = useCallback(async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const response = await api.listComments();
      setComments(response.comments);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to load comments."));
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

  useEffect(() => {
    if (!isActive || highlightCommentId === null) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(`${commentDomIdPrefix}-${highlightCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [commentDomIdPrefix, comments, highlightCommentId, isActive]);

  async function handleCreate(): Promise<void> {
    if (composerBody.trim().length < COMMENT_BODY_MIN_LENGTH) {
      setErrorMessage(`Comment must be at least ${COMMENT_BODY_MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await api.createComment({
        body: composerBody,
        parentCommentId: parentCommentId ?? undefined,
      });
      setComposerBody("");
      setParentCommentId(null);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to post comment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(commentId: number): Promise<void> {
    if (editDraft.trim().length < COMMENT_BODY_MIN_LENGTH) {
      setErrorMessage(`Comment must be at least ${COMMENT_BODY_MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await api.updateComment(commentId, { body: editDraft });
      setEditingCommentId(null);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to update comment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(commentId: number): Promise<void> {
    setBusy(true);
    setErrorMessage(null);
    try {
      await api.deleteComment(commentId);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to delete comment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCommentAttachment(
    commentId: number,
    attachmentId: string,
  ): Promise<void> {
    setErrorMessage(null);
    setBusy(true);
    try {
      await api.deleteCommentAttachment(commentId, attachmentId);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to delete attachment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleCommentAttachmentUpload(
    commentId: number,
    fileList: FileList | null,
  ): Promise<void> {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      for (const file of files) {
        await api.uploadCommentAttachment(commentId, file);
      }
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(comment: Comment): void {
    setEditingCommentId(comment.id);
    setEditDraft(comment.body);
  }

  if (!isActive) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{panelTitle}</Typography>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Paper sx={{ bgcolor: "action.hover", p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <TextField
            autoFocus
            fullWidth
            label="New comment (markdown)"
            minRows={4}
            multiline
            onChange={(event) => setComposerBody(event.target.value)}
            value={composerBody}
          />
          <Typography color="text.secondary" variant="body2">
            {editorHelpText}
          </Typography>
          {parentCommentId !== null ? (
            <Chip
              clickable
              color="primary"
              label={<span>{createReplyChipLabel(parentCommentId)}</span>}
              onClick={() => onNavigateToComment(parentCommentId)}
              onDelete={() => setParentCommentId(null)}
              variant="outlined"
            />
          ) : null}
          <Stack direction="row" spacing={1}>
            <Button disabled={busy} onClick={() => void handleCreate()} variant="contained">
              Post comment
            </Button>
            {busy ? <CircularProgress size={22} /> : null}
          </Stack>
        </Stack>
      </Paper>
      <Divider />
      {busy && comments.length === 0 ? (
        <Stack alignItems="center" direction="row" spacing={1}>
          <CircularProgress size={20} />
          <Typography>Loading comments…</Typography>
        </Stack>
      ) : null}
      <Stack spacing={2}>
        {comments.map((comment) => {
          const parent = comment.parentCommentId === null
            ? undefined
            : findCommentById(comments, comment.parentCommentId);
          const isHighlighted = highlightCommentId === comment.id;
          const canEdit = comment.createdByUserId === currentUserId;
          const hasAttachments = comment.attachments.length > 0;

          return (
            <Box
              id={`${commentDomIdPrefix}-${comment.id}`}
              key={comment.id}
              sx={{
                borderColor: isHighlighted ? "primary.main" : "divider",
                borderRadius: 1,
                borderStyle: "solid",
                borderWidth: isHighlighted ? 2 : 1,
                p: 1.5,
              }}
            >
              <Stack
                alignItems="center"
                direction="row"
                flexWrap="wrap"
                justifyContent="space-between"
                spacing={1}
              >
                <Stack
                  alignItems="center"
                  direction="row"
                  flexWrap="wrap"
                  spacing={1}
                  sx={{ flex: "1 1 auto", minWidth: 0 }}
                >
                  <Typography color="text.secondary" component="span" variant="caption">
                    #
                    {comment.id}
                    {" "}
                    · user
                    {comment.createdByUserId}
                    {" "}
                    ·
                    {comment.createdAt}
                  </Typography>
                  {parent ? (
                    <Chip
                      clickable
                      color="default"
                      label={(
                        <Typography component="span" variant="caption">
                          {createReplyChipLabel(parent.id)}
                        </Typography>
                      )}
                      onClick={() => onNavigateToComment(parent.id)}
                      size="small"
                      sx={{
                        "& .MuiChip-label": {
                          display: "block",
                          px: 1,
                          py: 0.25,
                          whiteSpace: "normal",
                        },
                        height: "auto",
                        maxWidth: "100%",
                        py: 0.25,
                      }}
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    onClick={() => onNavigateToComment(comment.id)}
                    size="small"
                    type="button"
                    variant="text"
                  >
                    Permalink
                  </Button>
                  <Button
                    onClick={() => setParentCommentId(comment.id)}
                    size="small"
                    type="button"
                    variant="text"
                  >
                    Reply
                  </Button>
                </Stack>
              </Stack>
              {editingCommentId === comment.id ? (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    minRows={3}
                    multiline
                    onChange={(event) => setEditDraft(event.target.value)}
                    value={editDraft}
                  />
                  <Typography color="text.secondary" variant="body2">
                    {editorHelpText}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      disabled={busy}
                      onClick={() => void handleSaveEdit(comment.id)}
                      size="small"
                      variant="contained"
                    >
                      Save
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => setEditingCommentId(null)}
                      size="small"
                      variant="text"
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                renderMarkdown(comment.body, { commentId: comment.id })
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {canEdit ? (
                  <>
                    <Button
                      disabled={busy || editingCommentId !== null}
                      onClick={() => beginEdit(comment)}
                      size="small"
                      variant="outlined"
                    >
                      Edit
                    </Button>
                    <Button
                      color="error"
                      disabled={busy}
                      onClick={() => void handleDelete(comment.id)}
                      size="small"
                      variant="outlined"
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
                <Button
                  component="label"
                  disabled={busy}
                  size="small"
                  variant="text"
                >
                  Add attachment(s)
                  <input
                    hidden
                    multiple
                    onChange={(event) =>
                      void handleCommentAttachmentUpload(comment.id, event.target.files)}
                    type="file"
                  />
                </Button>
              </Stack>
              <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
                {COMMENT_ATTACHMENT_MAX_FILE_SIZE_MESSAGE}
              </Typography>
              {hasAttachments ? <Divider sx={{ mt: 1.5 }} /> : null}
              <CommentAttachmentsList
                onDelete={(attachmentId) =>
                  void handleDeleteCommentAttachment(comment.id, attachmentId)}
                onDownload={(attachmentId, filename) =>
                  void downloadAttachment(
                    token,
                    resolveAttachmentDownloadPath,
                    attachmentId,
                    filename,
                  )}
                rows={comment.attachments}
              />
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
