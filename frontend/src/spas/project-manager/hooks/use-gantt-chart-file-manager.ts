import { useCallback, useEffect, useRef, useState } from "react";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { ganttApi } from "../api/gantt-api.js";
import { DEFAULT_PROJECT_CHART_XML } from "../lib/default-project-chart-xml.js";
import {
  type GgtcTaskExtensionMissingAttributeReport,
  GgtcDhtmlxGanttExtensionsManager,
} from "../lib/ggtc-dhtmlx-gantt-extensions-manager.js";
import type { GanttChartHandle } from "../models/gantt-chart-handle.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";

export interface PersistChartResult {
  didPersist: boolean;
  missingExtensionAttributeReports: GgtcTaskExtensionMissingAttributeReport[];
}

export interface UseGanttChartFileManagerResult {
  chartSource: GanttChartSource | null;
  clearPersistError: () => void;
  hasServerChart: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isPersisting: boolean;
  loadErrorMessage: string | null;
  persistChart: () => Promise<PersistChartResult>;
  persistErrorMessage: string | null;
  reloadChart: () => Promise<void>;
  setDirtyFromEditor: () => void;
  setInitialBaseline: (serializedXml: string) => void;
}

const DEFAULT_ERROR = "Unable to load that gantt chart right now.";
const SAVE_ERROR = "Unable to save the gantt chart right now.";

export function useGanttChartFileManager(options: {
  ganttRef: React.RefObject<GanttChartHandle | null>;
  projectId: number | null;
  token: string;
}): UseGanttChartFileManagerResult {
  const { ganttRef, projectId, token } = options;
  const [chartSource, setChartSource] = useState<GanttChartSource | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [persistErrorMessage, setPersistErrorMessage] = useState<string | null>(null);
  const [hasServerChart, setHasServerChart] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(projectId !== null);
  const [isPersisting, setIsPersisting] = useState(false);
  const lastSavedXmlRef = useRef<string | null>(null);
  const extensionsManagerRef = useRef(new GgtcDhtmlxGanttExtensionsManager());

  const loadChart = useCallback(async () => {
    if (projectId === null) {
      setChartSource(null);
      setLoadErrorMessage(null);
      setPersistErrorMessage(null);
      setHasServerChart(false);
      lastSavedXmlRef.current = null;
      setIsDirty(false);
      setIsLoading(false);
      return;
    }

    setChartSource(null);
    setLoadErrorMessage(null);
    setPersistErrorMessage(null);
    setIsLoading(true);
    lastSavedXmlRef.current = null;
    setIsDirty(false);

    try {
      const loaded = await ganttApi.getProjectChartOrNull(token, projectId);
      if (loaded) {
        const normalizationResult = extensionsManagerRef.current.normalizeXmlTasksWithExtensionAttrs(
          loaded.content,
        );
        setHasServerChart(true);
        setChartSource({
          content: normalizationResult.xml,
          type: loaded.type,
        });
      } else {
        setHasServerChart(false);
        setChartSource(null);
      }
    } catch (error) {
      setLoadErrorMessage(getApiErrorMessage(error, DEFAULT_ERROR));
      setChartSource(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  const setInitialBaseline = useCallback((serializedXml: string) => {
    lastSavedXmlRef.current = serializedXml;
    setIsDirty(false);
  }, []);

  const setDirtyFromEditor = useCallback(() => {
    const current = ganttRef.current?.getSerializedXml();
    const baseline = lastSavedXmlRef.current;
    if (current === undefined || baseline === null) {
      return;
    }
    setIsDirty(current !== baseline);
  }, [ganttRef]);

  /**
   * Persists the current chart XML. This path **does not** merge or default GGTC extension attributes:
   * it uploads whatever `getSerializedXml()` returns and uses `scanXmlForMissingExtensionAttrs` only as an
   * **enforcement** diagnostic when required attributes are absent from that XML (hooks or serializer merge
   * were insufficient). Chart enrichment belongs to load-time normalization and task event listeners; see
   * `docs/gantt-chart-ggtc-extensions.md`.
   */
  const persistChart = useCallback(async (): Promise<PersistChartResult> => {
    if (projectId === null) {
      return {
        didPersist: false,
        missingExtensionAttributeReports: [],
      };
    }
    const xml = ganttRef.current?.getSerializedXml() ?? DEFAULT_PROJECT_CHART_XML;
    const missingExtensionAttributeReports = extensionsManagerRef.current.scanXmlForMissingExtensionAttrs(
      xml,
    );

    setIsPersisting(true);
    setPersistErrorMessage(null);
    try {
      await ganttApi.putProjectChart(token, projectId, xml);
      lastSavedXmlRef.current = xml;
      setIsDirty(false);
      setHasServerChart(true);
      setChartSource({
        content: xml,
        type: "xml",
      });
      return {
        didPersist: true,
        missingExtensionAttributeReports,
      };
    } catch (error) {
      setPersistErrorMessage(getApiErrorMessage(error, SAVE_ERROR));
      return {
        didPersist: false,
        missingExtensionAttributeReports,
      };
    } finally {
      setIsPersisting(false);
    }
  }, [ganttRef, projectId, token]);

  const clearPersistError = useCallback(() => {
    setPersistErrorMessage(null);
  }, []);

  return {
    chartSource,
    clearPersistError,
    hasServerChart,
    isDirty,
    isLoading,
    isPersisting,
    loadErrorMessage,
    persistChart,
    persistErrorMessage,
    reloadChart: loadChart,
    setDirtyFromEditor,
    setInitialBaseline,
  };
}
