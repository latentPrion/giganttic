import { z } from "zod";

import { requestJson } from "../../../common/api/http-client.js";

interface JournalApiFactoryOptions<GetResponse, SubjectId> {
  getResponseSchema: z.ZodType<GetResponse>;
  resolvePath: (projectId: number, subjectId: SubjectId) => string;
}

export function createJournalApi<GetResponse, SubjectId>(
  options: JournalApiFactoryOptions<GetResponse, SubjectId>,
) {
  return {
    async getJournal(
      token: string,
      projectId: number,
      subjectId: SubjectId,
    ): Promise<GetResponse> {
      return await requestJson({
        method: "GET",
        path: options.resolvePath(projectId, subjectId),
        responseSchema: options.getResponseSchema,
        token,
      });
    },

    async updateJournal(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      markdown: string,
    ): Promise<GetResponse> {
      return await requestJson({
        body: { markdown },
        method: "PUT",
        path: options.resolvePath(projectId, subjectId),
        requestSchema: z.object({ markdown: z.string() }),
        responseSchema: options.getResponseSchema,
        token,
      });
    },
  };
}
