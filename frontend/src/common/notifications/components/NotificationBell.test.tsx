import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { notificationsApi } from "../notifications-api.js";
import { emitUserNotificationsStateEvent } from "../user-notifications-state-events.js";
import { NotificationBell } from "./NotificationBell.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../notifications-api.js", () => ({
  notificationsApi: {
    getNotificationSummary: vi.fn(),
    listNotifications: vi.fn(),
    listUnnoticedNotifications: vi.fn(),
    toggleNotificationNoticed: vi.fn(),
  },
}));

const notificationsApiMock = vi.mocked(notificationsApi);

describe("NotificationBell", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    notificationsApiMock.getNotificationSummary.mockReset();
    notificationsApiMock.listUnnoticedNotifications.mockReset();
    notificationsApiMock.toggleNotificationNoticed.mockReset();
    notificationsApiMock.getNotificationSummary.mockResolvedValue({ unnoticedCount: 2 });
    notificationsApiMock.listUnnoticedNotifications.mockResolvedValue({
      notifications: [
        {
          createdAt: "2026-03-29T00:00:00.000Z",
          eventCategory: "comments",
          eventType: "NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED",
          hasBeenNoticed: false,
          id: 7,
          message: "alice commented on Issue \"API rollout\" under Project 4",
          noticedTimestamp: null,
          targetUrl: "/pm/project/issue?projectId=4&id=17&tab=comments&commentId=31",
        },
      ],
    });
    notificationsApiMock.toggleNotificationNoticed.mockResolvedValue({
      hasBeenNoticed: true,
      id: 7,
      noticedTimestamp: "2026-03-29T00:00:01.000Z",
    });
  });

  it("shows the unnoticed badge count and lists the top unnoticed notifications", async () => {
    const user = userEvent.setup();

    renderWithTheme(<NotificationBell token="token-1" />);

    expect(await screen.findByLabelText("Notifications (2 unnoticed)")).toBeVisible();

    await user.click(screen.getByLabelText("Notifications (2 unnoticed)"));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText(/alice commented on Issue/i)).toBeVisible();
    expect(within(menu).getByRole("link", { name: "View all notifications" })).toBeVisible();
  });

  it("renders mention notifications through the shared bell row UI", async () => {
    const user = userEvent.setup();
    notificationsApiMock.listUnnoticedNotifications.mockResolvedValueOnce({
      notifications: [
        {
          createdAt: "2026-03-29T00:00:00.000Z",
          eventCategory: "mentions",
          eventType: "NOTIFICATION_EVENT_ISSUE_COMMENT_MENTIONED",
          hasBeenNoticed: false,
          id: 8,
          message: "alice mentioned you in a comment on Issue \"API rollout\" under Project 4.",
          noticedTimestamp: null,
          targetUrl: "/pm/project/issue?projectId=4&id=17&tab=comments&commentId=31",
        },
      ],
    });

    renderWithTheme(<NotificationBell token="token-1" />);
    await user.click(await screen.findByLabelText("Notifications (2 unnoticed)"));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText(/alice mentioned you in a comment/i)).toBeVisible();
  });

  it("marks a notification noticed and navigates when the row is clicked", async () => {
    const user = userEvent.setup();

    renderWithTheme(<NotificationBell token="token-1" />);
    await user.click(await screen.findByLabelText("Notifications (2 unnoticed)"));
    await user.click(await screen.findByRole("menuitem", {
      name: /alice commented on Issue/i,
    }));

    await waitFor(() => {
      expect(notificationsApiMock.toggleNotificationNoticed).toHaveBeenCalledWith("token-1", 7);
    });
    expect(navigateMock).toHaveBeenCalledWith(
      "/pm/project/issue?projectId=4&id=17&tab=comments&commentId=31",
    );
  });

  it("toggles noticed state from the eye button without navigating", async () => {
    const user = userEvent.setup();

    renderWithTheme(<NotificationBell token="token-1" />);
    await user.click(await screen.findByLabelText("Notifications (2 unnoticed)"));
    const menu = await screen.findByRole("menu");

    await user.click(within(menu).getByRole("button", { name: "Mark notification noticed" }));

    expect(notificationsApiMock.toggleNotificationNoticed).toHaveBeenCalledWith("token-1", 7);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("refreshes the badge count when a cross-tab notification event fires", async () => {
    notificationsApiMock.getNotificationSummary
      .mockResolvedValueOnce({ unnoticedCount: 2 })
      .mockResolvedValueOnce({ unnoticedCount: 5 });

    renderWithTheme(<NotificationBell token="token-1" />);
    expect(await screen.findByLabelText("Notifications (2 unnoticed)")).toBeVisible();

    emitUserNotificationsStateEvent();

    expect(await screen.findByLabelText("Notifications (5 unnoticed)")).toBeVisible();
  });
});
