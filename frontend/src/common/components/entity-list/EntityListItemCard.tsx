import React from "react";
import {
  ButtonBase,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface EntityListItemCardProps {
  actionContent?: React.ReactNode;
  children?: React.ReactNode;
  description: string | null;
  onNavigate?(): void;
  title: string;
  viewMode: EntityListItemViewMode;
}

const CARD_PADDING = "1rem 1.25rem";
const CONTENT_GAP = 2;
const DETAILS_GAP = 0.5;

function shouldRenderActions(viewMode: EntityListItemViewMode): boolean {
  return viewMode === "main-listing-view";
}

function stopActionPropagation(event: React.MouseEvent<HTMLElement>): void {
  event.stopPropagation();
}

export function EntityListItemCard(props: EntityListItemCardProps) {
  const showActions = shouldRenderActions(props.viewMode) && props.actionContent;
  const isNavigable = props.onNavigate !== undefined;

  return (
    <Paper elevation={0} sx={{ padding: CARD_PADDING }}>
      <Stack
        alignItems={{ sm: "center", xs: "flex-start" }}
        direction={{ sm: "row", xs: "column" }}
        justifyContent="space-between"
        spacing={CONTENT_GAP}
      >
        <ButtonBase
          disabled={!isNavigable}
          onClick={props.onNavigate}
          sx={{
            alignItems: "stretch",
            borderRadius: 2,
            display: "flex",
            flex: 1,
            justifyContent: "flex-start",
            opacity: isNavigable ? 1 : 0.84,
            textAlign: "left",
            width: "100%",
          }}
        >
          <Stack spacing={DETAILS_GAP} sx={{ width: "100%" }}>
            <Typography variant="h6">{props.title}</Typography>
            {props.description ? (
              <Typography color="text.secondary" variant="body2">
                {props.description}
              </Typography>
            ) : null}
            {props.children}
          </Stack>
        </ButtonBase>
        {showActions ? (
          <Stack
            direction={{ sm: "row", xs: "column" }}
            onClick={stopActionPropagation}
            spacing={1}
          >
            {props.actionContent}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
