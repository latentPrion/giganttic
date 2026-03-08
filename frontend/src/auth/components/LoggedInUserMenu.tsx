import React, { useState, type MouseEvent } from "react";
import {
  Button,
  Menu,
} from "@mui/material";

import { AdminMenuItems } from "./AdminMenuItems.js";
import { MySessionManagementMenuItems } from "./MySessionManagementMenuItems.js";
import { ProjectManagementMenuItems } from "./ProjectManagementMenuItems.js";

interface LoggedInUserMenuProps {
  isBusy: boolean;
  onLogout(): Promise<void>;
  roles: string[];
}

const ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";
const PROJECT_MANAGER_ROLE_CODES = [
  "GGTC_PROJECTROLE_PROJECT_MANAGER",
  "GGTC_TEAMROLE_PROJECT_MANAGER",
] as const;
const MENU_TRIGGER_LABEL = "Menu";
const MENU_BUTTON_HOVER_BACKGROUND = "rgba(255, 255, 255, 0.12)";
const MENU_BUTTON_HOVER_BORDER_COLOR = "rgba(255, 255, 255, 0.24)";
const MENU_BUTTON_HOVER_TRANSLATE_Y = "-1px";

function hasRole(roles: string[], roleCode: string): boolean {
  return roles.includes(roleCode);
}

function hasProjectManagementRole(roles: string[]): boolean {
  return PROJECT_MANAGER_ROLE_CODES.some((roleCode) => hasRole(roles, roleCode));
}

export function LoggedInUserMenu(props: LoggedInUserMenuProps) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  function openMenu(event: MouseEvent<HTMLButtonElement>): void {
    setAnchorElement(event.currentTarget);
  }

  function closeMenu(): void {
    setAnchorElement(null);
  }

  async function logout(): Promise<void> {
    await props.onLogout();
    closeMenu();
  }

  return (
    <>
      <Button
        aria-controls={anchorElement ? "logged-in-user-menu" : undefined}
        aria-expanded={anchorElement ? "true" : undefined}
        aria-haspopup="menu"
        color="inherit"
        onClick={openMenu}
        sx={{
          border: "1px solid transparent",
          transition: "background-color 140ms ease, border-color 140ms ease, transform 140ms ease",
          "&:hover": {
            backgroundColor: MENU_BUTTON_HOVER_BACKGROUND,
            borderColor: MENU_BUTTON_HOVER_BORDER_COLOR,
            transform: `translateY(${MENU_BUTTON_HOVER_TRANSLATE_Y})`,
          },
        }}
        variant="text"
      >
        {MENU_TRIGGER_LABEL}
      </Button>
      <Menu
        anchorEl={anchorElement}
        id="logged-in-user-menu"
        onClose={closeMenu}
        open={Boolean(anchorElement)}
      >
        <MySessionManagementMenuItems
          disabled={props.isBusy}
          onLogout={logout}
        />
        {hasProjectManagementRole(props.roles) ? (
          <ProjectManagementMenuItems />
        ) : null}
        {hasRole(props.roles, ADMIN_ROLE_CODE) ? <AdminMenuItems /> : null}
      </Menu>
    </>
  );
}
