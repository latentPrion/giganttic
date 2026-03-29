import React from "react";
import {
  Chip,
  Stack,
} from "@mui/material";

interface DiscussionTabLabelProps {
  count: number | null;
  countTestId?: string;
  label: string;
}

export function DiscussionTabLabel(props: DiscussionTabLabelProps) {
  const {
    count,
    countTestId,
    label,
  } = props;

  return (
    <Stack alignItems="center" direction="row" spacing={1}>
      <span>{label}</span>
      {count !== null ? (
        <Chip
          data-testid={countTestId}
          label={count}
          size="small"
          variant="outlined"
        />
      ) : null}
    </Stack>
  );
}
