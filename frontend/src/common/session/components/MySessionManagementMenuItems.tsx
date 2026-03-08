import React from "react";
import { MenuItem } from "@mui/material";

interface MySessionManagementMenuItemsProps {
  disabled: boolean;
  onLogout(): Promise<void>;
}

const LOGOUT_LABEL = "Logout";

export function MySessionManagementMenuItems(
  props: MySessionManagementMenuItemsProps,
) {
  return (
    <MenuItem
      disabled={props.disabled}
      onClick={() => void props.onLogout()}
    >
      {LOGOUT_LABEL}
    </MenuItem>
  );
}
