import { useEffect, useState } from "react";

import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { canEditProject } from "../lib/project-edit-permissions.js";

export function useProjectEditAccess(options: {
  currentUserId: number | undefined;
  projectId: number | null;
  token: string;
}) {
  const { currentUserId, projectId, token } = options;
  const [canEdit, setCanEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (projectId === null) {
      setCanEdit(false);
      setErrorMessage(null);
      return;
    }

    let mounted = true;

    async function load(): Promise<void> {
      try {
        const response = await lobbyApi.getProject(token, projectId!);
        if (mounted) {
          setCanEdit(canEditProject(currentUserId, undefined, response));
          setErrorMessage(null);
        }
      } catch (error) {
        if (mounted) {
          setCanEdit(false);
          setErrorMessage(getApiErrorMessage(error, "Unable to load project access."));
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [currentUserId, projectId, token]);

  return {
    canEdit,
    projectAccessErrorMessage: errorMessage,
  };
}
