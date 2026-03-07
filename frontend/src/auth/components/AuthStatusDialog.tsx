import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface AuthStatusDialogProps {
  isOpen: boolean;
  message: string;
  onClose(): void;
  title: string;
}

const CLOSE_BUTTON_LABEL = "Close";
const DIALOG_MAX_WIDTH = "xs";
const DIALOG_ACTIONS_PADDING = 3;
const DIALOG_ACTIONS_TOP_PADDING = 1;

export function AuthStatusDialog(props: AuthStatusDialogProps) {
  return (
    <Dialog
      fullWidth
      maxWidth={DIALOG_MAX_WIDTH}
      onClose={props.onClose}
      open={props.isOpen}
    >
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1">{props.message}</Typography>
      </DialogContent>
      <DialogActions
        sx={{
          padding: DIALOG_ACTIONS_PADDING,
          paddingTop: DIALOG_ACTIONS_TOP_PADDING,
        }}
      >
        <Button onClick={props.onClose} type="button" variant="contained">
          {CLOSE_BUTTON_LABEL}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
