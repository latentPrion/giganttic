import React from "react";
import { Button, Typography } from "@mui/material";

import type { ScopedAccessTokenScope } from "../../../spas/user/contracts/scoped-token.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface TokenObjectListItemProps {
  onDelete?(): void;
  renderObjectLink?(
    tokenScope: ScopedAccessTokenScope,
  ): React.ReactNode;
  tokenScope: ScopedAccessTokenScope;
  viewMode: EntityListItemViewMode;
}

function buildScopeTitle(tokenScope: ScopedAccessTokenScope): string {
  return `${tokenScope.objectTypeCode} #${tokenScope.objectId}`;
}

export function TokenObjectListItem(props: TokenObjectListItemProps) {
  return (
    <EntityListItemCard
      actionContent={(
        <Button onClick={props.onDelete} size="small" variant="text">
          Delete
        </Button>
      )}
      description={`Object ID: ${props.tokenScope.objectId}`}
      title={buildScopeTitle(props.tokenScope)}
      viewMode={props.viewMode}
    >
      {props.renderObjectLink ? (
        props.renderObjectLink(props.tokenScope)
      ) : (
        <Typography color="text.secondary" variant="body2">
          Link unavailable for this object.
        </Typography>
      )}
    </EntityListItemCard>
  );
}
