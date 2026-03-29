import { useCallback, useEffect, useState } from "react";

import { isApiError } from "../../../common/api/api-error.js";

interface UseDiscussionItemCountOptions {
  isEnabled: boolean;
  loadCount: () => Promise<number>;
  subscribeToChanges?: ((handler: () => void) => (() => void)) | undefined;
}

function isNotFoundApiError(error: unknown): boolean {
  return isApiError(error) && error.kind === "http" && error.status === 404;
}

export function useDiscussionItemCount(options: UseDiscussionItemCountOptions) {
  const {
    isEnabled,
    loadCount,
    subscribeToChanges,
  } = options;
  const [count, setCount] = useState<number | null>(null);

  const reloadCount = useCallback(async (mountedRef: { current: boolean }) => {
    try {
      const nextCount = await loadCount();
      if (mountedRef.current) {
        setCount(nextCount);
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      if (isNotFoundApiError(error)) {
        setCount(0);
        return;
      }

      setCount(null);
    }
  }, [loadCount]);

  useEffect(() => {
    if (!isEnabled) {
      setCount(null);
      return undefined;
    }

    const mountedRef = { current: true };
    void reloadCount(mountedRef);

    const unsubscribe = subscribeToChanges?.(() => {
      void reloadCount(mountedRef);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe?.();
    };
  }, [isEnabled, reloadCount, subscribeToChanges]);

  return {
    count,
  };
}
