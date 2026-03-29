import {
  getDiscussionJournalResponseSchema,
  type GetDiscussionJournalResponse,
} from "../contracts/journal.contracts.js";
import { createJournalApi } from "./journal-api-factory.js";

export const projectJournalApi = createJournalApi<GetDiscussionJournalResponse, null>({
  getResponseSchema: getDiscussionJournalResponseSchema,
  resolvePath: (projectId) => `/projects/${projectId}/journal`,
});
