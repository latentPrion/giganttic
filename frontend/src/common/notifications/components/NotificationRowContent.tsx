import React from "react";
import { Stack, Typography } from "@mui/material";

interface NotificationRowContentProps {
  createdAt: string;
  message: string;
}

function formatNotificationTimestamp(createdAtIso: string): string {
  const createdAt = new Date(createdAtIso);
  return createdAt.toLocaleString();
}

export function NotificationRowContent(props: NotificationRowContentProps) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography sx={{ overflowWrap: "anywhere" }} variant="body2">
        {props.message}
      </Typography>
      <Typography color="text.secondary" variant="caption">
        {formatNotificationTimestamp(props.createdAt)}
      </Typography>
    </Stack>
  );
}

