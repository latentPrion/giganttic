import React from "react";
import { Button, Stack, Typography } from "@mui/material";

import type { ScopedAccessToken } from "../../../spas/user/contracts/scoped-token.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface TokenListItemProps {
  onCopyLoginLink?(): void;
  onEditScope?(): void;
  onRevoke?(): void;
  retainedLoginLink?: string;
  retainedTokenValue?: string;
  tokenCredential: ScopedAccessToken;
  viewMode: EntityListItemViewMode;
}

function createTokenSecondaryLabel(tokenCredential: ScopedAccessToken): string {
  return `Scopes: ${tokenCredential.scopes.length}`;
}

export function TokenListItem(props: TokenListItemProps) {
  const actionContent = (
    <Stack direction="row" spacing={1}>
      {props.retainedTokenValue ? (
        <Button onClick={props.onCopyLoginLink} size="small" variant="outlined">
          Copy login link
        </Button>
      ) : null}
      <Button onClick={props.onEditScope} size="small" variant="outlined">
        Edit scope
      </Button>
      <Button onClick={props.onRevoke} size="small" variant="text">
        Revoke
      </Button>
    </Stack>
  );

  return (
    <EntityListItemCard
      actionContent={actionContent}
      description={createTokenSecondaryLabel(props.tokenCredential)}
      title={`Token #${props.tokenCredential.id}`}
      viewMode={props.viewMode}
    >
      {props.retainedTokenValue ? (
        <Stack spacing={0.5}>
          <Typography color="warning.main" variant="body2">
            Token value retained in this SPA session.
          </Typography>
          {props.retainedLoginLink ? (
            <Typography
              color="primary"
              component="a"
              href={props.retainedLoginLink}
              onClick={(event) => event.stopPropagation()}
              rel="noopener noreferrer"
              target="_blank"
              variant="body2"
            >
              Open login link
            </Typography>
          ) : null}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          Token value is only available immediately after minting in this SPA session.
        </Typography>
      )}
    </EntityListItemCard>
  );
}
