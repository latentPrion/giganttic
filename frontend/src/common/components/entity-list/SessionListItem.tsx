import React from "react";
import { Button, Stack, Typography } from "@mui/material";

import type { SessionSummary } from "../../session/contracts/auth.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface SessionListItemProps {
  onRevoke?(): void;
  session: SessionSummary;
  viewMode: EntityListItemViewMode;
}

function createSessionDescription(session: SessionSummary): string {
  return `IP: ${session.ipAddress}${session.location ? ` | Location: ${session.location}` : ""}`;
}

export function SessionListItem(props: SessionListItemProps) {
  return (
    <EntityListItemCard
      actionContent={(
        <Button onClick={props.onRevoke} size="small" variant="text">
          Revoke
        </Button>
      )}
      description={createSessionDescription(props.session)}
      title={`Session ${props.session.id}`}
      viewMode={props.viewMode}
    >
      <Stack spacing={0.25}>
        <Typography color="text.secondary" variant="body2">
          Started: {props.session.startTimestamp}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Expires: {props.session.expirationTimestamp}
        </Typography>
      </Stack>
    </EntityListItemCard>
  );
}
