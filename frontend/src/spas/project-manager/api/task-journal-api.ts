import {
  getTaskJournalResponseSchema,
  type GetTaskJournalResponse,
} from "../contracts/journal.contracts.js";
import { createJournalApi } from "./journal-api-factory.js";

interface TaskSubjectId {
  chartId: number;
  taskId: string;
}

export const taskJournalApi = createJournalApi<GetTaskJournalResponse, TaskSubjectId>({
  getResponseSchema: getTaskJournalResponseSchema,
  resolvePath: (projectId, subject) =>
    `/projects/${projectId}/charts/${subject.chartId}/tasks/${encodeURIComponent(subject.taskId)}/journal`,
});
