import type {
  CreateTeamRequest,
  GetTeamResponse,
  LobbyTeam,
  UpdateTeamRequest,
} from "../../contracts/lobby.contracts.js";
import { TEAM_SUMMARY_MEMBER_PREVIEW_LIMIT } from "./team-modal.constants.js";

export function createTeamFormState(team: LobbyTeam | null) {
  return {
    description: team?.description ?? "",
    name: team?.name ?? "",
  };
}

export function normalizeTeamCreatePayload(formState: {
  description: string;
  name: string;
}): CreateTeamRequest {
  return {
    description: formState.description.trim() === "" ? null : formState.description,
    name: formState.name,
  };
}

export function normalizeTeamUpdatePayload(formState: {
  description: string;
  name: string;
}): UpdateTeamRequest {
  return {
    description: formState.description.trim() === "" ? null : formState.description,
    name: formState.name,
  };
}

export function createTeamMemberPreview(response: GetTeamResponse): string[] {
  return response.members
    .slice(0, TEAM_SUMMARY_MEMBER_PREVIEW_LIMIT)
    .map((member) => `${member.username} (${member.roleCodes.join(", ") || "member"})`);
}

export function formatTeamSummaryTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}
