import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface EntitySummaryPlaceholderDialogProps {
  entityLabel: string | null;
  isOpen: boolean;
  onClose(): void;
}

function buildDialogMessage(entityLabel: string | null): string {
  if (!entityLabel) {
    return "";
  }

  return `${entityLabel} summary is not implemented in the user lobby yet.`;
}

export function EntitySummaryPlaceholderDialog(
  props: EntitySummaryPlaceholderDialogProps,
) {
  return (
    <Dialog onClose={props.onClose} open={props.isOpen}>
      <DialogTitle>Summary Unavailable</DialogTitle>
      <DialogContent>
        <Typography>{buildDialogMessage(props.entityLabel)}</Typography>
      </DialogContent>
      <DialogActions sx={{ padding: 3, paddingTop: 1 }}>
        <Button onClick={props.onClose} type="button">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
