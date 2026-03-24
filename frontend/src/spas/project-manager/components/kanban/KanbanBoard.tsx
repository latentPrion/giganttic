import React from "react";
import { Stack } from "@mui/material";
import type { IssueStatus } from "../../contracts/issue.contracts.js";

import { KanbanColumn } from "./KanbanColumn.js";
import { KanbanColumnDivider } from "./KanbanColumnDivider.js";
import type { KanbanColumnModel } from "./kanban.types.js";

function renderColumnSeparator(index: number, columnCount: number) {
  return index < columnCount - 1 ? <KanbanColumnDivider /> : null;
}

export function KanbanBoard(props: {
  columns: KanbanColumnModel[];
  isBusy: boolean;
  onIssueStatusChange: (issueId: number, status: IssueStatus) => void;
  onTaskStatusChange: (taskId: string, status: IssueStatus) => void;
}) {
  return (
    <Stack
      direction={{ lg: "row", xs: "column" }}
      spacing={{ lg: 0, xs: 2 }}
      sx={{ width: "100%" }}
    >
      {props.columns.map((column, index) => (
        <React.Fragment key={column.value}>
          <Stack sx={{ flex: 1, minWidth: 0, paddingX: { lg: 1, xs: 0 } }}>
            <KanbanColumn
              column={column}
              isBusy={props.isBusy}
              onIssueStatusChange={props.onIssueStatusChange}
              onTaskStatusChange={props.onTaskStatusChange}
            />
          </Stack>
          {renderColumnSeparator(index, props.columns.length)}
        </React.Fragment>
      ))}
    </Stack>
  );
}
