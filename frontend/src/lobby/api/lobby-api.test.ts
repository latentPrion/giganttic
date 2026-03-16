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

  it("creates a project with typed payload validation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        project: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Created project",
          id: 12,
          name: "Created",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await lobbyApi.createProject(TEST_TOKEN, {
      description: "Created project",
      name: "Created",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects",
      expect.objectContaining({
        body: JSON.stringify({
          description: "Created project",
          name: "Created",
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
  });

  it("loads visible users for member association", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        users: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            id: 15,
            isActive: true,
            updatedAt: "2026-03-08T00:00:00.000Z",
            username: "teammate",
          },
        ],
      }),
    );

    const response = await lobbyApi.listUsers(TEST_TOKEN);

    expect(response.users[0]?.username).toBe("teammate");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/users",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "GET",
      }),
    );
  });

  it("loads a project summary with members", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: [
          {
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
            userId: 9,
            username: "manager",
          },
        ],
        organizations: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            description: "Org description",
            id: 31,
            name: "Org 31",
            updatedAt: "2026-03-08T00:00:00.000Z",
          },
        ],
        project: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Example project",
          id: 11,
          name: "Alpha",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
        projectManagers: [
          {
            sourceKinds: ["direct"],
            userId: 9,
            username: "manager",
          },
        ],
        teams: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            description: "Team description",
            id: 22,
            name: "Ops",
            updatedAt: "2026-03-08T00:00:00.000Z",
          },
        ],
      }),
    );

    const response = await lobbyApi.getProject(TEST_TOKEN, 11);

    expect(response.members).toHaveLength(1);
    expect(response.projectManagers[0]?.sourceKinds).toEqual(["direct"]);
    expect(response.teams[0]?.id).toBe(22);
    expect(response.organizations[0]?.id).toBe(31);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects/11",
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

  it("assigns a team to an organization with typed payload validation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        organizationId: 22,
        teams: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            description: "Operators",
            id: 7,
            name: "Ops",
            updatedAt: "2026-03-08T00:00:00.000Z",
          },
        ],
      }),
    );

    await lobbyApi.assignOrganizationTeam(TEST_TOKEN, 22, {
      teamId: 7,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/organizations/22/teams",
      expect.objectContaining({
        body: JSON.stringify({
          teamId: 7,
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "POST",
      }),
    );
  });

  it("removes a team from an organization", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        organizationId: 22,
        teams: [],
      }),
    );

    await lobbyApi.unassignOrganizationTeam(TEST_TOKEN, 22, 7);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/organizations/22/teams/7",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "DELETE",
      }),
    );
  });

  it("creates a team with typed payload validation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        team: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Created team",
          id: 22,
          name: "Operators",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await lobbyApi.createTeam(TEST_TOKEN, {
      description: "Created team",
      name: "Operators",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/teams",
      expect.objectContaining({
        body: JSON.stringify({
          description: "Created team",
          name: "Operators",
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
  });

  it("loads a team summary with members", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: 9,
            username: "manager",
          },
        ],
        team: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Operators",
          id: 22,
          name: "Ops",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
        teamManagers: [
          {
            userId: 9,
            username: "manager",
          },
        ],
        teamProjectManagers: [
          {
            userId: 10,
            username: "project-manager",
          },
        ],
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

    const response = await lobbyApi.getTeam(TEST_TOKEN, 22);

    expect(response.members).toHaveLength(1);
    expect(response.teamManagers[0]?.username).toBe("manager");
    expect(response.teamProjectManagers[0]?.username).toBe("project-manager");
    expect(response.projects[0]?.id).toBe(11);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/teams/22",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "GET",
      }),
    );
  });

  it("sends typed team updates", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        team: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Updated team",
          id: 22,
          name: "Updated Ops",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await lobbyApi.updateTeam(TEST_TOKEN, 22, {
      description: "Updated team",
      name: "Updated Ops",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/teams/22",
      expect.objectContaining({
        body: JSON.stringify({
          description: "Updated team",
          name: "Updated Ops",
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        }),
        method: "PATCH",
      }),
    );
  });

  it("sends delete requests for teams", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        deletedTeamId: 22,
      }),
    );

    await lobbyApi.deleteTeam(TEST_TOKEN, 22);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/teams/22",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "DELETE",
      }),
    );
  });

  it("creates an organization with typed payload validation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        organization: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Created organization",
          id: 31,
          name: "Platform Org",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await lobbyApi.createOrganization(TEST_TOKEN, {
      description: "Created organization",
      name: "Platform Org",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/organizations",
      expect.objectContaining({
        body: JSON.stringify({
          description: "Created organization",
          name: "Platform Org",
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
  });

  it("loads an organization summary", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: [
          {
            roleCodes: ["GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER"],
            userId: 9,
            username: "manager",
          },
        ],
        organization: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Platform org",
          id: 31,
          name: "Platform Org",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
        organizationManagers: [
          {
            userId: 9,
            username: "manager",
          },
        ],
        organizationProjectManagers: [
          {
            userId: 10,
            username: "project-manager",
          },
        ],
        organizationTeamManagers: [
          {
            userId: 11,
            username: "team-manager",
          },
        ],
        projects: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            description: "Example project",
            id: 11,
            name: "Alpha",
            updatedAt: "2026-03-08T00:00:00.000Z",
          },
        ],
        teams: [
          {
            createdAt: "2026-03-08T00:00:00.000Z",
            description: "Operators",
            id: 22,
            name: "Ops",
            updatedAt: "2026-03-08T00:00:00.000Z",
          },
        ],
      }),
    );

    const response = await lobbyApi.getOrganization(TEST_TOKEN, 31);

    expect(response.projects).toHaveLength(1);
    expect(response.teams[0]?.id).toBe(22);
    expect(response.organizationManagers[0]?.username).toBe("manager");
    expect(response.organizationProjectManagers[0]?.username).toBe("project-manager");
    expect(response.organizationTeamManagers[0]?.username).toBe("team-manager");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/organizations/31",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "GET",
      }),
    );
  });

  it("loads a user profile summary", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        organizations: [{
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Org description",
          id: 31,
          name: "Platform Org",
          updatedAt: "2026-03-08T00:00:00.000Z",
        }],
        projects: [{
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Project description",
          id: 11,
          name: "Alpha",
          updatedAt: "2026-03-08T00:00:00.000Z",
        }],
        teams: [{
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Team description",
          id: 22,
          name: "Ops",
          updatedAt: "2026-03-08T00:00:00.000Z",
        }],
        user: {
          createdAt: "2026-03-08T00:00:00.000Z",
          id: 9,
          isActive: true,
          updatedAt: "2026-03-08T00:00:00.000Z",
          username: "manager",
        },
      }),
    );

    const response = await lobbyApi.getUser(TEST_TOKEN, 9);

    expect(response.user.username).toBe("manager");
    expect(response.projects[0]?.id).toBe(11);
    expect(response.teams[0]?.id).toBe(22);
    expect(response.organizations[0]?.id).toBe(31);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/users/9",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "GET",
      }),
    );
  });

  it("sends typed organization updates", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        organization: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Updated organization",
          id: 31,
          name: "Updated Org",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await lobbyApi.updateOrganization(TEST_TOKEN, 31, {
      description: "Updated organization",
      name: "Updated Org",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/organizations/31",
      expect.objectContaining({
        body: JSON.stringify({
          description: "Updated organization",
          name: "Updated Org",
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        }),
        method: "PATCH",
      }),
    );
  });

  it("sends delete requests for organizations", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        deletedOrganizationId: 31,
      }),
    );

    await lobbyApi.deleteOrganization(TEST_TOKEN, 31);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/organizations/31",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "DELETE",
      }),
    );
  });

  it("sends typed project updates", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        project: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Updated project",
          id: 14,
          name: "Renamed",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await lobbyApi.updateProject(TEST_TOKEN, 14, {
      description: "Updated project",
      name: "Renamed",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/projects/14",
      expect.objectContaining({
        body: JSON.stringify({
          description: "Updated project",
          name: "Renamed",
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
          "Content-Type": "application/json",
        }),
        method: "PATCH",
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

  it("rejects malformed project summary responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: "wrong-type",
        project: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Example project",
          id: 11,
          name: "Alpha",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await expect(lobbyApi.getProject(TEST_TOKEN, 11)).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects malformed team summary responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: "wrong-type",
        team: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Ops",
          id: 22,
          name: "Ops",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
      }),
    );

    await expect(lobbyApi.getTeam(TEST_TOKEN, 22)).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects malformed organization summary responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        members: [],
        organization: {
          createdAt: "2026-03-08T00:00:00.000Z",
          description: "Org",
          id: 31,
          name: "Org",
          updatedAt: "2026-03-08T00:00:00.000Z",
        },
        projects: "wrong-type",
        teams: [],
      }),
    );

    await expect(lobbyApi.getOrganization(TEST_TOKEN, 31)).rejects.toBeInstanceOf(ApiError);
  });
});
