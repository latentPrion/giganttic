import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerMgrUploadsPage } from "./ProjectManagerMgrUploadsPage.js";

const listFilesMock = vi.fn();
const uploadFileMock = vi.fn();
const deleteFileMock = vi.fn();

vi.mock("../api/mgr-uploads-api.js", () => ({
  mgrUploadsApi: {
    deleteFile: (...args: unknown[]) => deleteFileMock(...args),
    listFiles: (...args: unknown[]) => listFilesMock(...args),
    uploadFile: (...args: unknown[]) => uploadFileMock(...args),
  },
}));

vi.mock("../components/ProjectManagerProjectNavigation.js", () => ({
  ProjectManagerProjectNavigation: () => null,
}));

describe("ProjectManagerMgrUploadsPage", () => {
  const defaultStorage = {
    availableBytes: 123456789,
    availableMib: 117.74,
    devicePath: "/dev/sda1",
  };

  beforeEach(() => {
    listFilesMock.mockReset();
    uploadFileMock.mockReset();
    deleteFileMock.mockReset();
    listFilesMock.mockResolvedValue({
      files: [
        { name: "a.txt", sizeBytes: 3, updatedAtMs: 1 },
      ],
      storage: defaultStorage,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a forbidden state when listing returns 403", async () => {
    listFilesMock.mockRejectedValueOnce(
      new ApiError("http", "Forbidden", { status: 403 }),
    );

    renderWithTheme(
      <ProjectManagerMgrUploadsPage token="tok" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/do not have manager access/i),
      ).toBeInTheDocument();
    });
  });

  it("uploads a selected file and refreshes the list", async () => {
    const user = userEvent.setup();
    uploadFileMock.mockResolvedValue({
      name: "new.bin",
      sizeBytes: 2,
      updatedAtMs: 2,
    });
    listFilesMock.mockResolvedValueOnce({
      files: [{ name: "a.txt", sizeBytes: 3, updatedAtMs: 1 }],
      storage: defaultStorage,
    });
    listFilesMock.mockResolvedValueOnce({
      files: [
        { name: "a.txt", sizeBytes: 3, updatedAtMs: 1 },
        { name: "new.bin", sizeBytes: 2, updatedAtMs: 2 },
      ],
      storage: defaultStorage,
    });

    renderWithTheme(
      <ProjectManagerMgrUploadsPage token="tok" />,
    );

    await waitFor(() => {
      expect(screen.getByText("a.txt")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      "#mgr-uploads-file-input",
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["hi"], "new.bin", { type: "application/octet-stream" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith("tok", file);
    });

    await waitFor(() => {
      expect(screen.getByText("new.bin")).toBeInTheDocument();
    });
  });

  it("shows available /dev/sda1 storage in bytes and MiB", async () => {
    renderWithTheme(
      <ProjectManagerMgrUploadsPage token="tok" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Available on /dev/sda1: 123456789 bytes (117.74 MiB)"),
      ).toBeInTheDocument();
    });
  });
});
