import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { notificationsApi } from "../../../common/notifications/notifications-api.js";
import { ProjectManagerNotificationsPage } from "./ProjectManagerNotificationsPage.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../common/notifications/notifications-api.js", () => ({
  notificationsApi: {
    listNotifications: vi.fn(),
    toggleNotificationNoticed: vi.fn(),
  },
}));

const notificationsApiMock = vi.mocked(notificationsApi);

describe("ProjectManagerNotificationsPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    notificationsApiMock.listNotifications.mockReset();
    notificationsApiMock.toggleNotificationNoticed.mockReset();
    notificationsApiMock.listNotifications.mockResolvedValue({
      limit: 20,
      notifications: [
        {
          createdAt: "2026-03-29T00:00:00.000Z",
          eventCategory: "attachments",
          eventType: "NOTIFICATION_EVENT_PROJECT_ATTACHMENT_CREATED",
          hasBeenNoticed: false,
          id: 11,
          message: "alice added a project attachment under Project 4",
          noticedTimestamp: null,
          targetUrl: "/pm/pm/project?projectId=4&tab=attachments",
        },
      ],
      offset: 0,
      totalCount: 1,
    });
    notificationsApiMock.toggleNotificationNoticed.mockResolvedValue({
      hasBeenNoticed: true,
      id: 11,
      noticedTimestamp: "2026-03-29T00:00:01.000Z",
    });
  });

  it("renders notifications, pagination controls, and filtering controls", async () => {
    renderWithTheme(
      <ProjectManagerNotificationsPage
        currentUserId={1}
        currentUserRoles={[]}
        token="token-1"
      />,
    );

    expect(await screen.findByText("Notifications")).toBeVisible();
    expect(screen.getByLabelText("Rows per page")).toBeVisible();
    expect(screen.getByRole("button", { name: "Event types" })).toBeVisible();
    expect(screen.getByText("Include noticed notifications")).toBeVisible();
  });

  it("lists the new issue-updates and mentions categories in the filter menu", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerNotificationsPage
        currentUserId={1}
        currentUserRoles={[]}
        token="token-1"
      />,
    );

    await screen.findByText("Notifications");
    await user.click(screen.getByRole("button", { name: "Event types" }));

    expect(await screen.findByRole("menuitemcheckbox", { name: "Issue updates" })).toBeVisible();
    expect(screen.getByRole("menuitemcheckbox", { name: "Mentions" })).toBeVisible();
  });

  it("filters by category and sort order through the shared list query state", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerNotificationsPage
        currentUserId={1}
        currentUserRoles={[]}
        token="token-1"
      />,
    );

    await screen.findByText("Notifications");
    await user.click(screen.getByRole("button", { name: "Event types" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Attachments" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Most recent first" }));

    await waitFor(() => {
      expect(notificationsApiMock.listNotifications).toHaveBeenLastCalledWith(
        "token-1",
        expect.objectContaining({
          eventTypes: ["attachments"],
          includeNoticed: false,
          limit: 20,
          offset: 0,
          sort: "asc",
        }),
      );
    });
  });

  it("toggles noticed state from the eye icon without navigating", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerNotificationsPage
        currentUserId={1}
        currentUserRoles={[]}
        token="token-1"
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Mark notification noticed" }));

    expect(notificationsApiMock.toggleNotificationNoticed).toHaveBeenCalledWith("token-1", 11);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to the target url when a notification row is clicked", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerNotificationsPage
        currentUserId={1}
        currentUserRoles={[]}
        token="token-1"
      />,
    );

    await user.click(await screen.findByRole("button", {
      name: /alice added a project attachment/i,
    }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/pm/project?projectId=4&tab=attachments");
  });
});
