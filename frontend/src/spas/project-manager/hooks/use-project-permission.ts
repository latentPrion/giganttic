import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type { GetProjectResponse } from "../../../lobby/contracts/lobby.contracts.js";

interface UseProjectPermissionOptions {
  currentUserId: number | undefined;
  errorFallbackMessage: string;
  projectId: number | null;
  token: string;
  transform(response: GetProjectResponse): boolean;
}

export function useProjectPermission(options: UseProjectPermissionOptions) {
  const {
    currentUserId,
    errorFallbackMessage,
    projectId,
    token,
    transform,
  } = options;
  const [canAccess, setCanAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (projectId === null || currentUserId === undefined) {
      setCanAccess(false);
      setErrorMessage(null);
      return;
    }

    let mounted = true;
    const projectIdForRequest = projectId;

    async function loadProjectPermission(): Promise<void> {
      try {
        const response = await lobbyApi.getProject(token, projectIdForRequest);
        if (!mounted) {
          return;
        }

        setCanAccess(transform(response));
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setCanAccess(false);
        setErrorMessage(getApiErrorMessage(error, errorFallbackMessage));
      }
    }

    void loadProjectPermission();

    return () => {
      mounted = false;
    };
  }, [currentUserId, errorFallbackMessage, projectId, token, transform]);

  return {
    canAccess,
    projectAccessErrorMessage: errorMessage,
  };
}
