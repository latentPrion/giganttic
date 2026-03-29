import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { DiscussionMarkdownRender } from "./DiscussionMarkdownRender.js";

const requestBlobMock = vi.fn();

vi.mock("../../../../common/api/http-client.js", () => ({
  requestBlob: (...args: unknown[]) => requestBlobMock(...args),
}));

function createResolver(
  prefix: string,
  buildDownloadPath: (suffix: string) => string | null,
  isAllowedInContext?: (suffix: string) => boolean,
) {
  return {
    buildDownloadPath,
    isAllowedInContext,
    prefix,
  };
}

describe("DiscussionMarkdownRender", () => {
  beforeEach(() => {
    requestBlobMock.mockReset();
    requestBlobMock.mockResolvedValue(new Blob(["image-bytes"], { type: "image/png" }));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test-url"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders an image through the first allowed resolver that matches the custom uri", async () => {
    renderWithTheme(
      <DiscussionMarkdownRender
        attachmentResolvers={[
          createResolver("gigantt://project-attachment/", (suffix) => `/project/${suffix}`),
          createResolver("gigantt://issue-attachment/", (suffix) => `/issue/${suffix}`),
        ]}
        markdown="![Project image](gigantt://project-attachment/project-att-1)"
        token="pm-token"
      />,
    );

    expect(
      await screen.findByRole("img", { name: "Project image" }),
    ).toHaveAttribute("src", "blob:test-url");
    expect(requestBlobMock).toHaveBeenCalledWith({
      path: "/project/project-att-1",
      token: "pm-token",
    });
    await waitFor(() => {
      expect(requestBlobMock).toHaveBeenCalledTimes(1);
    });
  });

  it("downloads links through the matching resolver", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <DiscussionMarkdownRender
        attachmentResolvers={[
          createResolver("gigantt://issue-attachment/", (suffix) => `/issue/${suffix}`),
        ]}
        markdown="[Download issue file](gigantt://issue-attachment/issue-att-1)"
        token="pm-token"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download issue file" }));

    await waitFor(() => {
      expect(requestBlobMock).toHaveBeenCalledWith({
        path: "/issue/issue-att-1",
        token: "pm-token",
      });
    });
  });

  it("falls back cleanly when a resolver exists but disallows the current context", async () => {
    renderWithTheme(
      <DiscussionMarkdownRender
        attachmentResolvers={[
          createResolver(
            "gigantt://issue-comment-attachment/",
            (suffix) => `/issue-comment/${suffix}`,
            () => false,
          ),
        ]}
        markdown="![Blocked image](gigantt://issue-comment-attachment/12/att-1)"
        token="pm-token"
      />,
    );

    const image = await screen.findByRole("img", { name: "Blocked image" });
    expect(image).toHaveAttribute("src", "gigantt://issue-comment-attachment/12/att-1");
    expect(requestBlobMock).not.toHaveBeenCalled();
  });

  it("falls back cleanly when the uri matches no custom resolver", async () => {
    renderWithTheme(
      <DiscussionMarkdownRender
        attachmentResolvers={[
          createResolver("gigantt://task-attachment/", (suffix) => `/task/${suffix}`),
        ]}
        markdown="[External](https://example.com/file.png)"
        token="pm-token"
      />,
    );

    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "href",
      "https://example.com/file.png",
    );
    expect(requestBlobMock).not.toHaveBeenCalled();
  });
});
