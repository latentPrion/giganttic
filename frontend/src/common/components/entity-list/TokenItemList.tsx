import React from "react";
import { Stack } from "@mui/material";

import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface TokenItemListProps {
  children?: React.ReactNode;
  viewMode: EntityListItemViewMode;
}

const LIST_SPACING = 1.5;

function createViewModeAttributes(viewMode: EntityListItemViewMode) {
  return {
    "data-token-item-list": "true",
    "data-view-mode": viewMode,
  } as const;
}

export function TokenItemList(props: TokenItemListProps) {
  return (
    <Stack spacing={LIST_SPACING} {...createViewModeAttributes(props.viewMode)}>
      {props.children}
    </Stack>
  );
}
