import React, { useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  Button,
  Menu,
  MenuItem,
} from "@mui/material";

export interface GanttControlActionMenuItem {
  color?: "error" | "inherit";
  disabled?: boolean;
  label: string;
  onClick: () => void;
}

interface GanttControlActionMenuProps {
  buttonLabel: string;
  disabled?: boolean;
  items: readonly GanttControlActionMenuItem[];
}

export function GanttControlActionMenu(props: GanttControlActionMenuProps) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);

  function handleOpenMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    setAnchorElement(event.currentTarget);
  }

  function handleCloseMenu(): void {
    setAnchorElement(null);
  }

  function handleSelectItem(onClick: () => void): void {
    onClick();
    handleCloseMenu();
  }

  return (
    <>
      <Button
        disabled={props.disabled}
        endIcon={<ArrowDropDownIcon />}
        onClick={handleOpenMenu}
        size="small"
        type="button"
        variant="outlined"
      >
        {props.buttonLabel}
      </Button>
      <Menu
        anchorEl={anchorElement}
        onClose={handleCloseMenu}
        open={anchorElement !== null}
      >
        {props.items.map((item) => (
          <MenuItem
            disabled={item.disabled}
            key={item.label}
            onClick={() => {
              handleSelectItem(item.onClick);
            }}
            sx={item.color === "error" ? { color: "error.main" } : undefined}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
