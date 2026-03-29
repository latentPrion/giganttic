import React from "react";
import { IconButton } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

interface NotificationNoticeToggleButtonProps {
  hasBeenNoticed: boolean;
  onToggle: () => Promise<void> | void;
}

export function NotificationNoticeToggleButton(
  props: NotificationNoticeToggleButtonProps,
) {
  const label = props.hasBeenNoticed
    ? "Mark notification unnoticed"
    : "Mark notification noticed";

  return (
    <IconButton
      aria-label={label}
      edge="end"
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        void props.onToggle();
      }}
      size="small"
    >
      {props.hasBeenNoticed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
    </IconButton>
  );
}

