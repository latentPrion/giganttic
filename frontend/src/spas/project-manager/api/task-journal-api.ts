import {
  getTaskJournalResponseSchema,
  type GetTaskJournalResponse,
} from "../contracts/journal.contracts.js";
import { createJournalApi } from "./journal-api-factory.js";

export const taskJournalApi = createJournalApi<GetTaskJournalResponse, string>({
  getResponseSchema: getTaskJournalResponseSchema,
  resolvePath: (projectId, taskId) =>
    `/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/journal`,
});
