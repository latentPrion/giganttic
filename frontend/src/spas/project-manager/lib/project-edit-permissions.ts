import type { GetProjectResponse } from "../../../lobby/contracts/lobby.contracts.js";

const PROJECT_OWNER_ROLE_CODE = "GGTC_PROJECTROLE_PROJECT_OWNER";

function hasRoleCode(
  member: GetProjectResponse["members"][number],
  roleCode: string,
): boolean {
  return member.roleCodes.includes(roleCode);
}

function canDeleteProject(
  currentUserId: number | undefined,
  _currentUserRoles: readonly string[] | undefined,
  response: GetProjectResponse | null,
): boolean {
  if (!response || currentUserId === undefined) {
    return false;
  }

  return response.members.some(
    (member) =>
      member.userId === currentUserId &&
      hasRoleCode(member, PROJECT_OWNER_ROLE_CODE),
  );
}

/**
 * Whether the user may edit project metadata and the chart file (manager or owner).
 */
export function canEditProject(
  currentUserId: number | undefined,
  currentUserRoles: readonly string[] | undefined,
  response: GetProjectResponse | null,
): boolean {
  if (!response || currentUserId === undefined) {
    return false;
  }

  return canDeleteProject(currentUserId, currentUserRoles, response) ||
    response.projectManagers.some(
      (projectManager) => projectManager.userId === currentUserId,
    );
}
