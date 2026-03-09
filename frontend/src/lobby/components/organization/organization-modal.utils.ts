import type {
  CreateOrganizationRequest,
  GetOrganizationResponse,
  LobbyOrganization,
  UpdateOrganizationRequest,
} from "../../contracts/lobby.contracts.js";
import { ORGANIZATION_SUMMARY_MEMBER_PREVIEW_LIMIT } from "./organization-modal.constants.js";

export function createOrganizationFormState(organization: LobbyOrganization | null) {
  return {
    description: organization?.description ?? "",
    name: organization?.name ?? "",
  };
}

export function normalizeOrganizationCreatePayload(formState: {
  description: string;
  name: string;
}): CreateOrganizationRequest {
  return {
    description: formState.description.trim() === "" ? null : formState.description,
    name: formState.name,
  };
}

export function normalizeOrganizationUpdatePayload(formState: {
  description: string;
  name: string;
}): UpdateOrganizationRequest {
  return {
    description: formState.description.trim() === "" ? null : formState.description,
    name: formState.name,
  };
}

export function createOrganizationMemberPreview(
  response: GetOrganizationResponse,
): string[] {
  return response.members
    .slice(0, ORGANIZATION_SUMMARY_MEMBER_PREVIEW_LIMIT)
    .map((member) => `${member.username} (${member.roleCodes.join(", ") || "member"})`);
}

export function formatOrganizationSummaryTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}
