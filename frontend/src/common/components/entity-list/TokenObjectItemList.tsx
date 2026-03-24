import React from "react";
import { Stack } from "@mui/material";

import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface TokenObjectItemListProps {
  children?: React.ReactNode;
  viewMode: EntityListItemViewMode;
}

const LIST_SPACING = 1.5;

function createViewModeAttributes(viewMode: EntityListItemViewMode) {
  return {
    "data-token-object-item-list": "true",
    "data-view-mode": viewMode,
  } as const;
}

export function TokenObjectItemList(props: TokenObjectItemListProps) {
  return (
    <Stack spacing={LIST_SPACING} {...createViewModeAttributes(props.viewMode)}>
      {props.children}
    </Stack>
  );
}
