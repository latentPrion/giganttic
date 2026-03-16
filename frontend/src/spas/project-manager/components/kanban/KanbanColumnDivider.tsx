import React from "react";
import { Divider } from "@mui/material";

export function KanbanColumnDivider() {
  return (
    <Divider
      flexItem
      orientation="vertical"
      sx={{ display: { xs: "none", lg: "block" } }}
    />
  );
}
