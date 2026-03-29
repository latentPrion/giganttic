import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";

interface DiscussionJournalSectionProps {
  canEdit: boolean;
  editorHelpText: string;
  emptyMarkdownMessage?: string;
  errorMessage: string | null;
  isLoading: boolean;
  isSaving: boolean;
  journalExists: boolean;
  markdown: string | null;
  missingStateMessage?: string | null;
  onSave: (markdown: string) => Promise<void>;
  renderMarkdown: (markdown: string) => React.ReactNode;
  sectionId?: string;
  title?: string;
}

const DEFAULT_EMPTY_MARKDOWN_MESSAGE = "No journal content yet.";

export function DiscussionJournalSection(
  props: DiscussionJournalSectionProps,
) {
  const {
    canEdit,
    editorHelpText,
    emptyMarkdownMessage = DEFAULT_EMPTY_MARKDOWN_MESSAGE,
    errorMessage,
    isLoading,
    isSaving,
    journalExists,
    markdown,
    missingStateMessage,
    onSave,
    renderMarkdown,
    sectionId,
    title = "Journal",
  } = props;

  const [draft, setDraft] = useState(markdown ?? "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(markdown ?? "");
    }
  }, [isEditing, markdown]);

  async function handleSave(): Promise<void> {
    await onSave(draft);
    setIsEditing(false);
  }

  function renderBody(): React.ReactNode {
    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading journal...</Typography>
        </Stack>
      );
    }

    if (isEditing) {
      return (
        <Stack spacing={1.5}>
          <TextField
            autoFocus
            fullWidth
            label="Journal markdown"
            minRows={10}
            multiline
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
          <Typography color="text.secondary" variant="body2">
            {editorHelpText}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              disabled={isSaving}
              onClick={() => void handleSave()}
              variant="contained"
            >
              Save journal
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
              variant="text"
            >
              Cancel
            </Button>
            {isSaving ? <CircularProgress size={20} /> : null}
          </Stack>
        </Stack>
      );
    }

    if (missingStateMessage) {
      return <Alert severity="info">{missingStateMessage}</Alert>;
    }

    if (!journalExists || !(markdown ?? "").trim()) {
      return (
        <Typography color="text.secondary" variant="body2">
          {emptyMarkdownMessage}
        </Typography>
      );
    }

    return renderMarkdown(markdown ?? "");
  }

  return (
    <Paper elevation={0} id={sectionId} sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Stack
          alignItems={{ sm: "center", xs: "flex-start" }}
          direction={{ sm: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
        >
          <Typography component="h2" variant="h5">
            {title}
          </Typography>
          {canEdit ? (
            <Button onClick={() => setIsEditing(true)} variant="outlined">
              {journalExists ? "Edit" : "Create + Edit"}
            </Button>
          ) : null}
        </Stack>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {renderBody()}
      </Stack>
    </Paper>
  );
}
