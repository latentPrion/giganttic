import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Alert,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Menu,
  MenuItem,
  Stack,
} from "@mui/material";

import {
  getApiErrorMessage,
  isApiError,
} from "../../../common/api/api-error.js";
import { ganttApi } from "../api/gantt-api.js";
import {
  type GanttDownloadFormat,
  type GetProjectChartExportCapabilitiesResponse,
} from "../contracts/gantt-export.contracts.js";
import { getDhtmlxGantt } from "../lib/dhtmlx-gantt-adapter.js";
import { downloadSelectedGanttFormat } from "../lib/gantt-download.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";

interface GanttDownloadSplitButtonProps {
  chartSource: GanttChartSource | null;
  isLoadingChart: boolean;
  projectId: number;
  token: string;
}

const DEFAULT_DOWNLOAD_ERROR_MESSAGE = "Unable to download that gantt chart right now.";
const DHTMLX_XML_LABEL = "DHTMLX Gantt XML";
const DOWNLOAD_BUTTON_LABEL = "Download";
const MS_PROJECT_UNAVAILABLE_LABEL = "MS Project XML [Unavailable]";
const MS_PROJECT_XML_LABEL = "MS Project XML";
const DEFAULT_SELECTED_DOWNLOAD_FORMAT: GanttDownloadFormat = "msProjectXml";
const SELECTED_FORMAT_LABELS: Record<GanttDownloadFormat, string> = {
  dhtmlxXml: DHTMLX_XML_LABEL,
  msProjectXml: MS_PROJECT_XML_LABEL,
};

function createDefaultCapabilities(): GetProjectChartExportCapabilitiesResponse {
  return {
    ganttExport: {
      dhtmlxXml: {
        enabled: true,
      },
      msProjectXml: {
        enabled: true,
        mode: "cloud_fallback",
        serverUrl: null,
      },
    },
  };
}

function createSelectedFormatChipLabel(
  selectedFormat: GanttDownloadFormat,
): string {
  return SELECTED_FORMAT_LABELS[selectedFormat];
}

function isPrimaryDownloadDisabled(
  chartSource: GanttChartSource | null,
  capabilities: GetProjectChartExportCapabilitiesResponse,
  isLoadingCapabilities: boolean,
  isLoadingChart: boolean,
  selectedFormat: GanttDownloadFormat,
): boolean {
  if (isLoadingChart || isLoadingCapabilities || chartSource === null) {
    return true;
  }

  if (selectedFormat === "msProjectXml") {
    return !capabilities.ganttExport.msProjectXml.enabled;
  }

  return false;
}

function createMsProjectMenuLabel(
  capabilities: GetProjectChartExportCapabilitiesResponse,
): string {
  return capabilities.ganttExport.msProjectXml.enabled
    ? MS_PROJECT_XML_LABEL
    : MS_PROJECT_UNAVAILABLE_LABEL;
}

function createDownloadButtonLabel(
  isLoadingCapabilities: boolean,
): React.ReactNode {
  if (isLoadingCapabilities) {
    return <CircularProgress color="inherit" size={18} />;
  }

  return DOWNLOAD_BUTTON_LABEL;
}

function executeDownload(
  selectedFormat: GanttDownloadFormat,
  chartSource: GanttChartSource,
  projectId: number,
  capabilities: GetProjectChartExportCapabilitiesResponse,
): void {
  downloadSelectedGanttFormat(
    selectedFormat,
    getDhtmlxGantt(),
    projectId,
    chartSource.content,
    capabilities,
  );
}

export function GanttDownloadSplitButton(
  props: GanttDownloadSplitButtonProps,
) {
  const [capabilities, setCapabilities] =
    useState<GetProjectChartExportCapabilitiesResponse>(createDefaultCapabilities);
  const [downloadErrorMessage, setDownloadErrorMessage] = useState<string | null>(null);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(true);
  const [menuAnchorElement, setMenuAnchorElement] = useState<HTMLElement | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<GanttDownloadFormat>(
    DEFAULT_SELECTED_DOWNLOAD_FORMAT,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadCapabilities(): Promise<void> {
      setIsLoadingCapabilities(true);
      setDownloadErrorMessage(null);

      try {
        const nextCapabilities = await ganttApi.getProjectChartExportCapabilities(props.token);

        if (isMounted) {
          setCapabilities(nextCapabilities);
        }
      } catch (error) {
        if (isMounted) {
          setCapabilities(createDefaultCapabilities());
          setDownloadErrorMessage(
            getApiErrorMessage(error, DEFAULT_DOWNLOAD_ERROR_MESSAGE),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCapabilities(false);
        }
      }
    }

    void loadCapabilities();

    return () => {
      isMounted = false;
    };
  }, [props.token]);

  useEffect(() => {
    if (capabilities.ganttExport.msProjectXml.enabled) {
      return;
    }

    if (selectedFormat === "msProjectXml") {
      setSelectedFormat("dhtmlxXml");
    }
  }, [capabilities, selectedFormat]);

  const isDownloadDisabled = useMemo(
    () =>
      isPrimaryDownloadDisabled(
        props.chartSource,
        capabilities,
        isLoadingCapabilities,
        props.isLoadingChart,
        selectedFormat,
      ),
    [
      capabilities,
      isLoadingCapabilities,
      props.chartSource,
      props.isLoadingChart,
      selectedFormat,
    ],
  );

  function handleOpenMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    setMenuAnchorElement(event.currentTarget);
  }

  function handleCloseMenu(): void {
    setMenuAnchorElement(null);
  }

  function handleSelectFormat(nextFormat: GanttDownloadFormat): void {
    setSelectedFormat(nextFormat);
    setDownloadErrorMessage(null);
    handleCloseMenu();
  }

  function handleDownload(): void {
    if (props.chartSource === null) {
      return;
    }

    try {
      executeDownload(
        selectedFormat,
        props.chartSource,
        props.projectId,
        capabilities,
      );
      setDownloadErrorMessage(null);
    } catch (error) {
      setDownloadErrorMessage(
        isApiError(error)
          ? getApiErrorMessage(error, DEFAULT_DOWNLOAD_ERROR_MESSAGE)
          : error instanceof Error
            ? error.message
            : DEFAULT_DOWNLOAD_ERROR_MESSAGE,
      );
    }
  }

  return (
    <Stack alignItems={{ xs: "stretch", sm: "flex-end" }} spacing={1}>
      <ButtonGroup
        aria-label="Gantt download options"
        sx={{ alignSelf: { xs: "stretch", sm: "flex-end" } }}
        variant="contained"
      >
        <Button
          disabled={isDownloadDisabled}
          onClick={handleDownload}
          startIcon={<DownloadIcon />}
          type="button"
        >
          <Stack alignItems="center" direction="row" spacing={1}>
            <span>{createDownloadButtonLabel(isLoadingCapabilities)}</span>
            <Chip
              color="default"
              label={createSelectedFormatChipLabel(selectedFormat)}
              size="small"
              sx={{ backgroundColor: "rgba(255, 255, 255, 0.18)", color: "inherit" }}
            />
          </Stack>
        </Button>
        <Button
          aria-label="Choose download format"
          onClick={handleOpenMenu}
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
        <MenuItem onClick={() => handleSelectFormat("dhtmlxXml")}>
          {DHTMLX_XML_LABEL}
        </MenuItem>
        <MenuItem
          disabled={!capabilities.ganttExport.msProjectXml.enabled}
          onClick={() => handleSelectFormat("msProjectXml")}
        >
          {createMsProjectMenuLabel(capabilities)}
        </MenuItem>
      </Menu>
      {downloadErrorMessage ? (
        <Alert severity="error" sx={{ maxWidth: 440 }}>
          {downloadErrorMessage}
        </Alert>
      ) : null}
    </Stack>
  );
}
