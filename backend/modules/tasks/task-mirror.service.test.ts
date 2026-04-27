import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskMirrorService } from "./task-mirror.service.js";

describe("TaskMirrorService", () => {
  const readProjectChartMock = vi.fn();
  const deleteTaskCommentBodyMock = vi.fn();
  const removeOrphanAttachmentsAndFilesMock = vi.fn();
  const selectAllMock = vi.fn();
  const selectGetMock = vi.fn();
  const deleteRunMock = vi.fn();
  const onConflictDoNothingMock = vi.fn(() => ({ run: vi.fn() }));
  const insertValuesMock = vi.fn(() => ({ onConflictDoNothing: onConflictDoNothingMock }));

  const databaseService = {
    db: {
      delete: vi.fn(() => ({
        where: vi.fn(() => ({ run: deleteRunMock })),
      })),
      insert: vi.fn(() => ({
        values: insertValuesMock,
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            all: selectAllMock,
            get: selectGetMock,
          })),
        })),
      })),
    },
  };

  const projectChartsService = {
    readProjectChart: readProjectChartMock,
  };

  const commentBodyStorage = {
    deleteTaskCommentBody: deleteTaskCommentBodyMock,
  };

  const attachmentService = {
    removeOrphanAttachmentsAndFiles: removeOrphanAttachmentsAndFilesMock,
  };

  const journalStorage = {
    deleteTaskJournal: vi.fn(),
  };

  const service = new TaskMirrorService(
    databaseService as never,
    projectChartsService as never,
    commentBodyStorage as never,
    attachmentService as never,
    journalStorage as never,
  );

  beforeEach(() => {
    readProjectChartMock.mockReset();
    deleteTaskCommentBodyMock.mockReset();
    removeOrphanAttachmentsAndFilesMock.mockReset();
    selectAllMock.mockReset();
    selectGetMock.mockReset();
    selectGetMock.mockReturnValue({ projectId: 42 });
    deleteRunMock.mockReset();
    onConflictDoNothingMock.mockClear();
    insertValuesMock.mockClear();
  });

  it("lists canonical task ids from the current chart xml", () => {
    readProjectChartMock.mockReturnValue("<data><task id=\"task-1\"/><task id=\"task-2\"/></data>");

    expect(service.listTaskIdsFromCurrentChart(42, 0)).toEqual(["task-1", "task-2"]);
  });

  it("creates task mirror rows lazily with conflict-ignore semantics", () => {
    service.ensureTaskMirrorExists(42, "task-7");

    expect(insertValuesMock).toHaveBeenCalledWith({ projectGanttChartId: 42, taskId: "task-7" });
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(1);
  });

  it("throws when a task is missing from the current chart", () => {
    readProjectChartMock.mockReturnValue("<data><task id=\"task-1\"/></data>");

    expect(() => service.assertTaskExistsInCurrentChart(42, 0, "task-7")).toThrowError(
      new NotFoundException("Task not found"),
    );
  });

  it("deletes comment bodies and orphan attachments when removed task ids are provided", async () => {
    selectAllMock.mockReturnValue([
      { id: 11, taskId: "task-1" },
      { id: 12, taskId: "task-2" },
    ]);

    await service.deleteRemovedTaskMirrorData(42, ["task-1", "task-2"]);

    expect(deleteTaskCommentBodyMock).toHaveBeenNthCalledWith(1, 42, "task-1", 11);
    expect(deleteTaskCommentBodyMock).toHaveBeenNthCalledWith(2, 42, "task-2", 12);
    expect(deleteRunMock).toHaveBeenCalledTimes(1);
    expect(removeOrphanAttachmentsAndFilesMock).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no removed task ids", async () => {
    await service.deleteRemovedTaskMirrorData(42, []);

    expect(selectAllMock).not.toHaveBeenCalled();
    expect(deleteTaskCommentBodyMock).not.toHaveBeenCalled();
    expect(deleteRunMock).not.toHaveBeenCalled();
    expect(removeOrphanAttachmentsAndFilesMock).not.toHaveBeenCalled();
  });
});
