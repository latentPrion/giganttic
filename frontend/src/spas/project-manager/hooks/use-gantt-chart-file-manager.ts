import { useCallback, useEffect, useRef, useState } from "react";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { emitFrontendDebugLog } from "../../../common/debug/frontend-debug-ingest.js";
import { ganttApi } from "../api/gantt-api.js";
import { DEFAULT_PROJECT_CHART_XML } from "../lib/default-project-chart-xml.js";
import {
  clearGanttRuntimeChartCacheEntry,
  clearGanttRuntimeChartValidationError,
  getGanttRuntimeChartCacheEntry,
  getGanttRuntimeChartValidationError,
  subscribeGanttRuntimeChartCache,
  trySetValidatedGanttRuntimeChartCacheEntry,
  type GanttRuntimeChartCacheEntry,
} from "../lib/gantt-runtime-chart-cache.js";
import { subscribeGanttRuntimeMetadataReloadRequestedEvent } from "../lib/gantt-runtime-chart-events.js";
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
  cache: {
    serializedXml: string | null;
    isInitialized: boolean;
  };
  clearPersistError: () => void;
  clearRuntimeValidationError: () => void;
  hasServerChart: boolean;
  isDirty: boolean;
  isLoading: boolean;
  isPersisting: boolean;
  loadErrorMessage: string | null;
  persistChart: () => Promise<PersistChartResult>;
  persistErrorMessage: string | null;
  reloadChart: () => Promise<void>;
  runtimeValidationErrorMessage: string | null;
  setDirtyFromEditor: () => void;
  setInitialBaseline: (serializedXml: string) => void;
}

const DEFAULT_ERROR = "Unable to load that gantt chart right now.";
const SAVE_ERROR = "Unable to save the gantt chart right now.";
const LEGACY_EMPTY_PROJECT_CHART_XML_VALUES = new Set(["<project/>", "<project />"]);

function normalizeKnownLegacyChartXml(xml: string): string {
  const trimmedXml = xml.trim();
  if (LEGACY_EMPTY_PROJECT_CHART_XML_VALUES.has(trimmedXml)) {
    return DEFAULT_PROJECT_CHART_XML;
  }
  return xml;
}

function emitDebugLog(
  location: string,
  message: string,
  hypothesisId: string,
  runId: string,
  data: Record<string, unknown>,
): void {
  emitFrontendDebugLog({
    data,
    hypothesisId,
    location,
    message,
    runId,
  });
}

export function useGanttChartFileManager(options: {
  chartId?: number;
  ganttRef: React.RefObject<GanttChartHandle | null>;
  projectId: number | null;
  token: string;
  preferRuntimeCacheOnLoad?: boolean;
}): UseGanttChartFileManagerResult {
  const {
    chartId = 0,
    ganttRef,
    projectId,
    token,
    preferRuntimeCacheOnLoad = true,
  } = options;
  const [chartSource, setChartSource] = useState<GanttChartSource | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [persistErrorMessage, setPersistErrorMessage] = useState<string | null>(null);
  const [runtimeValidationErrorMessage, setRuntimeValidationErrorMessage] =
    useState<string | null>(null);
  const [hasServerChart, setHasServerChart] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(projectId !== null);
  const [isPersisting, setIsPersisting] = useState(false);
  const lastSavedXmlRef = useRef<string | null>(null);
  const lastSeenProjectIdRef = useRef<number | null>(projectId);
  const extensionsManagerRef = useRef(new GgtcDhtmlxGanttExtensionsManager());
  const [runtimeCache, setRuntimeCache] = useState<GanttRuntimeChartCacheEntry | null>(() => {
    if (projectId === null) {
      return null;
    }
    return getGanttRuntimeChartCacheEntry(projectId, chartId) ?? null;
  });

  useEffect(() => {
    if (projectId === null) {
      setRuntimeCache(null);
      setRuntimeValidationErrorMessage(null);
      return undefined;
    }

    setRuntimeCache(getGanttRuntimeChartCacheEntry(projectId, chartId) ?? null);
    setRuntimeValidationErrorMessage(
      getGanttRuntimeChartValidationError(projectId, chartId)?.message ?? null,
    );
    return subscribeGanttRuntimeChartCache(projectId, chartId, () => {
      setRuntimeCache(getGanttRuntimeChartCacheEntry(projectId, chartId) ?? null);
      setRuntimeValidationErrorMessage(
        getGanttRuntimeChartValidationError(projectId, chartId)?.message ?? null,
      );
    });
  }, [chartId, projectId]);

  useEffect(() => {
    if (projectId === null) {
      return undefined;
    }

    return subscribeGanttRuntimeMetadataReloadRequestedEvent((detail) => {
      if (detail.projectId !== projectId) {
        return;
      }
      if ((detail.chartId ?? 0) !== chartId) {
        return;
      }

      const cachedEntry = getGanttRuntimeChartCacheEntry(projectId, chartId);
      if (!cachedEntry) {
        return;
      }

      setChartSource({
        content: cachedEntry.serializedXml,
        type: cachedEntry.type,
      });

      if (lastSavedXmlRef.current !== null) {
        setIsDirty(cachedEntry.serializedXml !== lastSavedXmlRef.current);
      }
    });
  }, [chartId, projectId]);

  const initializeChart = useCallback(async () => {
    const runId = `gantt-load-${Date.now()}`;
    if (projectId === null) {
      lastSeenProjectIdRef.current = null;
      setChartSource(null);
      setLoadErrorMessage(null);
      setPersistErrorMessage(null);
      setRuntimeValidationErrorMessage(null);
      setHasServerChart(false);
      lastSavedXmlRef.current = null;
      setIsDirty(false);
      setIsLoading(false);
      return;
    }

    const isProjectSwitch =
      lastSeenProjectIdRef.current !== null && lastSeenProjectIdRef.current !== projectId;
    lastSeenProjectIdRef.current = projectId;

    const existingCache = preferRuntimeCacheOnLoad
      ? isProjectSwitch
        ? undefined
        : getGanttRuntimeChartCacheEntry(projectId, chartId)
      : undefined;
    if (existingCache) {
      setChartSource({
        content: existingCache.serializedXml,
        type: existingCache.type,
      });
      setHasServerChart(true);
      setLoadErrorMessage(null);
      setPersistErrorMessage(null);
      setRuntimeValidationErrorMessage(null);
      setIsDirty(false);
      setIsLoading(false);
      return;
    }

    setChartSource(null);
    setLoadErrorMessage(null);
    setPersistErrorMessage(null);
    setRuntimeValidationErrorMessage(null);
    setIsLoading(true);
    lastSavedXmlRef.current = null;
    setIsDirty(false);

    try {
      const loaded = await ganttApi.getProjectChartOrNull(token, projectId, chartId);
      if (loaded) {
        const normalizedLoadedXml = normalizeKnownLegacyChartXml(loaded.content);
        const normalizationResult = extensionsManagerRef.current.normalizeXmlTasksWithExtensionAttrs(
          normalizedLoadedXml,
        );
        emitDebugLog(
          "use-gantt-chart-file-manager.ts:loadChart",
          "Loaded chart and normalized extension attributes",
          "H4",
          runId,
          {
            loadedType: loaded.type,
            mutatedTaskIds: normalizationResult.mutatedTaskIds,
            mutatedTaskCount: normalizationResult.mutatedTaskIds.length,
            projectId,
          },
        );
        setHasServerChart(true);
        setChartSource({
          content: normalizationResult.xml,
          type: loaded.type,
        });
        trySetValidatedGanttRuntimeChartCacheEntry(projectId, chartId, {
          serializedXml: normalizationResult.xml,
          type: "xml",
        });
      } else {
        setHasServerChart(false);
        setChartSource(null);
        clearGanttRuntimeChartCacheEntry(projectId, chartId);
      }
    } catch (error) {
      setLoadErrorMessage(getApiErrorMessage(error, DEFAULT_ERROR));
      setChartSource(null);
    } finally {
      setIsLoading(false);
    }
  }, [chartId, projectId, preferRuntimeCacheOnLoad, token]);

  const invalidateAndReloadChart = useCallback(async (): Promise<void> => {
    if (projectId === null) {
      await initializeChart();
      return;
    }

    clearGanttRuntimeChartCacheEntry(projectId, chartId);
    lastSavedXmlRef.current = null;
    setIsDirty(false);
    setChartSource(null);
    setLoadErrorMessage(null);
    setPersistErrorMessage(null);
    setRuntimeValidationErrorMessage(null);
    setHasServerChart(false);
    setIsLoading(true);

    await initializeChart();
  }, [chartId, initializeChart, projectId]);

  useEffect(() => {
    void initializeChart();
  }, [initializeChart]);

  const setInitialBaseline = useCallback((serializedXml: string) => {
    lastSavedXmlRef.current = serializedXml;
    setIsDirty(false);
    if (projectId !== null) {
      trySetValidatedGanttRuntimeChartCacheEntry(projectId, chartId, {
        serializedXml,
        type: "xml",
      });
    }
  }, [chartId, projectId]);

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
    const runId = `gantt-persist-${Date.now()}`;
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
    emitDebugLog(
      "use-gantt-chart-file-manager.ts:persistChart",
      "Persist preflight extension scan",
      "H3",
      runId,
      {
        missingReports: missingExtensionAttributeReports,
        missingReportsCount: missingExtensionAttributeReports.length,
        projectId,
      },
    );

    setIsPersisting(true);
    setPersistErrorMessage(null);
    try {
      await ganttApi.putProjectChart(token, projectId, xml, chartId);
      lastSavedXmlRef.current = xml;
      trySetValidatedGanttRuntimeChartCacheEntry(projectId, chartId, {
        serializedXml: xml,
        type: "xml",
      });
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
  }, [chartId, ganttRef, projectId, token]);

  const clearPersistError = useCallback(() => {
    setPersistErrorMessage(null);
  }, []);

  const clearRuntimeValidationError = useCallback(() => {
    if (projectId === null) {
      setRuntimeValidationErrorMessage(null);
      return;
    }

    clearGanttRuntimeChartValidationError(projectId, chartId);
  }, [chartId, projectId]);

  return {
    chartSource,
    cache: {
      serializedXml: runtimeCache?.serializedXml ?? null,
      isInitialized: runtimeCache !== null,
    },
    clearPersistError,
    clearRuntimeValidationError,
    hasServerChart,
    isDirty,
    isLoading,
    isPersisting,
    loadErrorMessage,
    persistChart,
    persistErrorMessage,
    reloadChart: invalidateAndReloadChart,
    runtimeValidationErrorMessage,
    setDirtyFromEditor,
    setInitialBaseline,
  };
}
