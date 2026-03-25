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
import { createIssueAttachmentDownloadPath } from "../../api/issue-attachment-paths.js";
import { issueCommentsApi } from "../../api/issue-comments-api.js";
import type { IssueComment } from "../../contracts/issue-comments.contracts.js";
import { IssueMarkdownRender } from "./IssueMarkdownRender.js";

const COMMENT_BODY_MIN_LENGTH = 16;
const PANEL_LABEL = "Comments";

interface IssueCommentsPanelProps {
  currentUserId: number;
  highlightCommentId: number | null;
  issueId: number;
  issueTab: string;
  onNavigateToComment: (commentId: number) => void;
  projectId: number;
  token: string;
}

function findCommentById(
  comments: IssueComment[],
  commentId: number,
): IssueComment | undefined {
  return comments.find((row) => row.id === commentId);
}

function CommentAttachmentsList(props: {
  onDownload: (attachmentId: string, filename: string) => void;
  onDelete: (attachmentId: string) => void;
  rows: IssueComment["attachments"];
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
            onClick={() => void props.onDelete(attachment.id)}
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
                props.onDownload(attachment.id, attachment.originalFilename)
              }
              type="button"
              underline="hover"
              sx={{ textAlign: "right" }}
            >
              {attachment.originalFilename} ({attachment.byteLength} bytes)
            </MuiLink>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export function IssueCommentsPanel(props: IssueCommentsPanelProps) {
  const {
    currentUserId,
    highlightCommentId,
    issueId,
    issueTab,
    onNavigateToComment,
    projectId,
    token,
  } = props;

  const [comments, setComments] = useState<IssueComment[]>([]);
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
      const response = await issueCommentsApi.listComments(token, projectId, issueId);
      setComments(response.comments);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to load comments."));
    } finally {
      setBusy(false);
    }
  }, [issueId, projectId, token]);

  useEffect(() => {
    if (issueTab !== "comments") {
      return undefined;
    }

    void reload();

    return undefined;
  }, [issueTab, reload]);

  useEffect(() => {
    if (issueTab !== "comments" || highlightCommentId === null) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(`issue-comment-${highlightCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [comments, highlightCommentId, issueTab]);

  async function handleCreate(): Promise<void> {
    if (composerBody.trim().length < COMMENT_BODY_MIN_LENGTH) {
      setErrorMessage(`Comment must be at least ${COMMENT_BODY_MIN_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await issueCommentsApi.createComment(token, projectId, issueId, {
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
      await issueCommentsApi.updateComment(token, projectId, issueId, commentId, {
        body: editDraft,
      });
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
      await issueCommentsApi.deleteComment(token, projectId, issueId, commentId);
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to delete comment."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadAttachment(
    attachmentId: string,
    filename: string,
  ): Promise<void> {
    try {
      const blob = await requestBlob({
        path: createIssueAttachmentDownloadPath(projectId, issueId, attachmentId),
        token,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Download failed."));
    }
  }

  async function handleDeleteCommentAttachment(
    commentId: number,
    attachmentId: string,
  ): Promise<void> {
    setErrorMessage(null);
    setBusy(true);
    try {
      await issueCommentsApi.deleteCommentAttachment(
        token,
        projectId,
        issueId,
        commentId,
        attachmentId,
      );
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
        await issueCommentsApi.uploadCommentAttachment(
          token,
          projectId,
          issueId,
          commentId,
          file,
        );
      }
      await reload();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Upload failed."));
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(comment: IssueComment): void {
    setEditingCommentId(comment.id);
    setEditDraft(comment.body);
  }

  if (issueTab !== "comments") {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{PANEL_LABEL}</Typography>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Paper sx={{ bgcolor: "action.hover", p: 2 }} variant="outlined">
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            label="New comment (markdown)"
            minRows={4}
            multiline
            onChange={(event) => setComposerBody(event.target.value)}
            value={composerBody}
          />
          {parentCommentId !== null ? (
            <Chip
              color="primary"
              label={(
                <span>
                  Replying to comment {parentCommentId}
                </span>
              )}
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
              id={`issue-comment-${comment.id}`}
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
                      color="default"
                      label={(
                        <Typography component="span" variant="caption">
                          Replying to comment{" "}
                          <MuiLink
                            component="button"
                            onClick={() => onNavigateToComment(parent.id)}
                            type="button"
                            underline="hover"
                          >
                            {parent.id}
                          </MuiLink>
                        </Typography>
                      )}
                      size="small"
                      sx={{
                        height: "auto",
                        maxWidth: "100%",
                        py: 0.25,
                        "& .MuiChip-label": { display: "block", px: 1, py: 0.25, whiteSpace: "normal" },
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
                <IssueMarkdownRender
                  issueId={issueId}
                  markdown={comment.body}
                  projectId={projectId}
                  token={token}
                />
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
              {hasAttachments ? <Divider sx={{ mt: 1.5 }} /> : null}
              <CommentAttachmentsList
                onDownload={(attachmentId, filename) =>
                  void handleDownloadAttachment(attachmentId, filename)}
                onDelete={(attachmentId) =>
                  void handleDeleteCommentAttachment(comment.id, attachmentId)}
                rows={comment.attachments}
              />
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
