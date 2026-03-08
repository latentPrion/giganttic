import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../common/api/api-error.js";
import { lobbyApi } from "./lobby-api.js";

const TEST_TOKEN = "test-token";

function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}

describe("lobbyApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the current user's projects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        projects: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            description: "Example project",
            id: 11,
            name: "Alpha",
            updatedAt: "2026-03-08T00:00:00.000Z",
          },
        ],
      }),
    );

    const response = await lobbyApi.listProjects(TEST_TOKEN);

    expect(response.projects[0]?.name).toBe("Alpha");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "GET",
      }),
    );
  });

  it("sends delete requests for projects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        deletedProjectId: 14,
      }),
    );

    await lobbyApi.deleteProject(TEST_TOKEN, 14);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects/14",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "DELETE",
      }),
    );
  });

  it("sends typed team membership replacements", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: 9,
            username: "manager",
          },
        ],
        teamId: 22,
      }),
    );

    await lobbyApi.replaceTeamMembers(TEST_TOKEN, 22, {
      members: [
        {
          roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
          userId: 9,
        },
      ],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/teams/22/members",
      expect.objectContaining({
        body: JSON.stringify({
          members: [
            {
              roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
              userId: 9,
            },
          ],
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "PUT",
      }),
    );
  });

  it("rejects malformed responses from the lobby backend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        deletedProjectId: "wrong-type",
      }),
    );

    await expect(lobbyApi.deleteProject(TEST_TOKEN, 14)).rejects.toBeInstanceOf(ApiError);
  });
});
