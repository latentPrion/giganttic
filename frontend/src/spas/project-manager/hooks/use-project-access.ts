import { useCallback } from "react";

import { useProjectPermission } from "./use-project-permission.js";

export function useProjectAccess(options: {
  currentUserId: number | undefined;
  projectId: number | null;
  token: string;
}) {
  const transform = useCallback(() => true, []);
  const permission = useProjectPermission({
    currentUserId: options.currentUserId,
    errorFallbackMessage: "Unable to load project access.",
    projectId: options.projectId,
    token: options.token,
    transform,
  });

  return {
    canAccess: permission.canAccess,
    projectAccessErrorMessage: permission.projectAccessErrorMessage,
  };
}
