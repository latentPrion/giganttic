import { useEffect, useState } from "react";

import { isApiError } from "../../../common/api/api-error.js";
import { mgrUploadsApi } from "../api/mgr-uploads-api.js";

export type MgrUploadsTabVisibilityState =
  | "loading"
  | "allowed"
  | "forbidden";

/**
 * Resolves whether the Shared uploads tab should be shown for the current bearer token.
 * The mgr-uploads pool is instance-global (not project-scoped); this probe does not use
 * project context. Visibility matches backend authorization via the list endpoint.
 */
export function useMgrUploadsTabVisibility(
  authToken: string | undefined,
): MgrUploadsTabVisibilityState {
  const [visibility, setVisibility] = useState<MgrUploadsTabVisibilityState>(
    "loading",
  );

  useEffect(() => {
    if (authToken === undefined) {
      setVisibility("forbidden");
      return;
    }

    const bearerToken = authToken;
    let cancelled = false;
    setVisibility("loading");

    async function probe(): Promise<void> {
      try {
        await mgrUploadsApi.listFiles(bearerToken);
        if (!cancelled) {
          setVisibility("allowed");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (isApiError(error) && error.kind === "http" && error.status === 403) {
          setVisibility("forbidden");
          return;
        }
        setVisibility("forbidden");
      }
    }

    void probe();

    return () => {
      cancelled = true;
    };
  }, [authToken]);

  return visibility;
}
