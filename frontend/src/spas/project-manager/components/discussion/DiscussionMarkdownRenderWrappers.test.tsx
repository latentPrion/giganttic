import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { IssueMarkdownRender } from "../issues/IssueMarkdownRender.js";
import { ProjectMarkdownRender } from "../projects/ProjectMarkdownRender.js";
import { TaskMarkdownRender } from "../tasks/TaskMarkdownRender.js";

const requestBlobMock = vi.fn();

vi.mock("../../../../common/api/http-client.js", () => ({
  requestBlob: (...args: unknown[]) => requestBlobMock(...args),
}));

async function expectRequestBlobCallCountToStayStable(callCount: number) {
  await waitFor(() => {
    expect(requestBlobMock).toHaveBeenCalledTimes(callCount);
  });
}

describe("Discussion markdown render wrappers", () => {
  beforeEach(() => {
    requestBlobMock.mockReset();
    requestBlobMock.mockResolvedValue(new Blob(["embed"], { type: "image/png" }));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:wrapper-test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("allows only project attachments in project journals", async () => {
    const { rerender } = renderWithTheme(
      <ProjectMarkdownRender
        markdown="![Project embed](gigantt://project-attachment/proj-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Project embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/attachments/proj-att-1/download",
      token: "pm-token",
    });

    const requestCountBeforeDeniedRerender = requestBlobMock.mock.calls.length;

    rerender(
      <ProjectMarkdownRender
        markdown="![Issue embed](gigantt://issue-attachment/issue-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    const deniedImage = await screen.findByRole("img", { name: "Issue embed" });
    expect(deniedImage).toHaveAttribute("src", "gigantt://issue-attachment/issue-att-1");
    await expectRequestBlobCallCountToStayStable(requestCountBeforeDeniedRerender);
  });

  it("allows project and parent issue attachments in issue contexts", async () => {
    const { rerender } = renderWithTheme(
      <IssueMarkdownRender
        issueId={17}
        markdown="![Project embed](gigantt://project-attachment/proj-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Project embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/attachments/proj-att-1/download",
      token: "pm-token",
    });

    requestBlobMock.mockClear();

    rerender(
      <IssueMarkdownRender
        issueId={17}
        markdown="![Issue embed](gigantt://issue-attachment/issue-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Issue embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/issues/17/attachments/issue-att-1/download",
      token: "pm-token",
    });
  });

  it("allows same-comment issue comment attachments only for the current comment", async () => {
    const { rerender } = renderWithTheme(
      <IssueMarkdownRender
        commentId={31}
        issueId={17}
        markdown="![Comment embed](gigantt://issue-comment-attachment/31/comment-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Comment embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/issues/17/comments/31/attachments/comment-att-1/download",
      token: "pm-token",
    });

    const requestCountBeforeDeniedRerender = requestBlobMock.mock.calls.length;

    rerender(
      <IssueMarkdownRender
        commentId={31}
        issueId={17}
        markdown="![Wrong comment embed](gigantt://issue-comment-attachment/99/comment-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    const deniedImage = await screen.findByRole("img", { name: "Wrong comment embed" });
    expect(deniedImage).toHaveAttribute(
      "src",
      "gigantt://issue-comment-attachment/99/comment-att-1",
    );
    await expectRequestBlobCallCountToStayStable(requestCountBeforeDeniedRerender);
  });

  it("allows project and parent task attachments in task contexts", async () => {
    const { rerender } = renderWithTheme(
      <TaskMarkdownRender
        markdown="![Project embed](gigantt://project-attachment/proj-att-1)"
        projectId={42}
        taskId="task-7"
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Project embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/attachments/proj-att-1/download",
      token: "pm-token",
    });

    requestBlobMock.mockClear();

    rerender(
      <TaskMarkdownRender
        markdown="![Task embed](gigantt://task-attachment/task-att-1)"
        projectId={42}
        taskId="task-7"
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Task embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/charts/0/tasks/task-7/attachments/task-att-1/download",
      token: "pm-token",
    });
  });

  it("allows same-comment task comment attachments only for the current comment", async () => {
    const { rerender } = renderWithTheme(
      <TaskMarkdownRender
        commentId={44}
        markdown="![Task comment embed](gigantt://task-comment-attachment/44/comment-att-1)"
        projectId={42}
        taskId="task-7"
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Task comment embed" })).toHaveAttribute(
      "src",
      "blob:wrapper-test",
    );
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/projects/42/charts/0/tasks/task-7/comments/44/attachments/comment-att-1/download",
      token: "pm-token",
    });

    const requestCountBeforeDeniedRerender = requestBlobMock.mock.calls.length;

    rerender(
      <TaskMarkdownRender
        commentId={44}
        markdown="![Wrong task comment embed](gigantt://task-comment-attachment/55/comment-att-1)"
        projectId={42}
        taskId="task-7"
        token="pm-token"
      />,
    );

    const deniedImage = await screen.findByRole("img", { name: "Wrong task comment embed" });
    expect(deniedImage).toHaveAttribute(
      "src",
      "gigantt://task-comment-attachment/55/comment-att-1",
    );
    await expectRequestBlobCallCountToStayStable(requestCountBeforeDeniedRerender);
  });

  it("does not allow issue/task attachments in the wrong wrapper context", async () => {
    const { rerender } = renderWithTheme(
      <IssueMarkdownRender
        issueId={17}
        markdown="![Blocked task attachment](gigantt://task-attachment/task-att-1)"
        projectId={42}
        token="pm-token"
      />,
    );

    expect(await screen.findByRole("img", { name: "Blocked task attachment" })).toHaveAttribute(
      "src",
      "gigantt://task-attachment/task-att-1",
    );
    await expectRequestBlobCallCountToStayStable(0);

    rerender(
      <TaskMarkdownRender
        markdown="![Blocked issue attachment](gigantt://issue-attachment/issue-att-1)"
        projectId={42}
        taskId="task-7"
        token="pm-token"
      />,
    );

    await expectRequestBlobCallCountToStayStable(0);
    expect(screen.getByRole("img", { name: "Blocked issue attachment" })).toHaveAttribute(
      "src",
      "gigantt://issue-attachment/issue-att-1",
    );
  });
});
