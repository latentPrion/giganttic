import React, { useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
  Box,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";

interface GanttSaveSplitButtonProps {
  hasServerChart: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isPersisting: boolean;
  onRefreshClick: () => void;
  onSaveClick: () => Promise<void>;
  showSavedState: boolean;
}

const REFRESH_LABEL = "Refresh";
const SAVED_ICON_TEST_ID = "gantt-save-status-saved";
const UNSAVED_ICON_TEST_ID = "gantt-save-status-unsaved";

function createSaveButtonLabel(hasServerChart: boolean): string {
  return hasServerChart ? "Save" : "Create";
}

function renderStateIndicator(
  isDirty: boolean,
  showSavedState: boolean,
): React.ReactNode {
  if (isDirty) {
    return (
      <Tooltip title="Unsaved changes">
        <WarningAmberRoundedIcon
          color="warning"
          data-testid={UNSAVED_ICON_TEST_ID}
          fontSize="small"
        />
      </Tooltip>
    );
  }

  if (!showSavedState) {
    return null;
  }

  return (
    <Tooltip title="Saved">
      <CheckCircleIcon
        color="success"
        data-testid={SAVED_ICON_TEST_ID}
        fontSize="small"
      />
    </Tooltip>
  );
}

export function GanttSaveSplitButton(props: GanttSaveSplitButtonProps) {
  const [menuAnchorElement, setMenuAnchorElement] = useState<HTMLElement | null>(null);
  const buttonLabel = createSaveButtonLabel(props.hasServerChart);
  const isButtonDisabled = props.isLoading || props.isPersisting;

  function handleOpenMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    setMenuAnchorElement(event.currentTarget);
  }

  function handleCloseMenu(): void {
    setMenuAnchorElement(null);
  }

  function handleRefreshClick(): void {
    props.onRefreshClick();
    handleCloseMenu();
  }

  return (
    <>
      <ButtonGroup
        aria-label="Gantt save options"
        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        variant="contained"
      >
        <Button
          disabled={isButtonDisabled}
          onClick={() => {
            void props.onSaveClick();
          }}
          size="small"
          type="button"
        >
          <Box alignItems="center" display="inline-flex" gap={1}>
            <span>{buttonLabel}</span>
            {renderStateIndicator(props.isDirty, props.showSavedState)}
          </Box>
        </Button>
        <Button
          aria-label="Choose save action"
          disabled={isButtonDisabled}
          onClick={handleOpenMenu}
          size="small"
          type="button"
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Menu
        anchorEl={menuAnchorElement}
        onClose={handleCloseMenu}
        open={menuAnchorElement !== null}
      >
        <MenuItem onClick={handleRefreshClick}>{REFRESH_LABEL}</MenuItem>
      </Menu>
    </>
  );
}
