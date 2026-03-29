import {
  getDiscussionJournalResponseSchema,
  type GetDiscussionJournalResponse,
} from "../contracts/journal.contracts.js";
import { createJournalApi } from "./journal-api-factory.js";

export const issueJournalApi = createJournalApi<GetDiscussionJournalResponse, number>({
  getResponseSchema: getDiscussionJournalResponseSchema,
  resolvePath: (projectId, issueId) => `/projects/${projectId}/issues/${issueId}/journal`,
});
