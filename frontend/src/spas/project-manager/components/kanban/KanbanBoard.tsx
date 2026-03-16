import React from "react";
import { Stack } from "@mui/material";

import { KanbanColumn } from "./KanbanColumn.js";
import { KanbanColumnDivider } from "./KanbanColumnDivider.js";
import type { KanbanColumnModel } from "./kanban.types.js";

function renderColumnSeparator(index: number, columnCount: number) {
  return index < columnCount - 1 ? <KanbanColumnDivider /> : null;
}

export function KanbanBoard(props: { columns: KanbanColumnModel[] }) {
  return (
    <Stack
      direction={{ lg: "row", xs: "column" }}
      spacing={{ lg: 0, xs: 2 }}
      sx={{ width: "100%" }}
    >
      {props.columns.map((column, index) => (
        <React.Fragment key={column.value}>
          <Stack sx={{ flex: 1, minWidth: 0, paddingX: { lg: 1, xs: 0 } }}>
            <KanbanColumn column={column} />
          </Stack>
          {renderColumnSeparator(index, props.columns.length)}
        </React.Fragment>
      ))}
    </Stack>
  );
}
