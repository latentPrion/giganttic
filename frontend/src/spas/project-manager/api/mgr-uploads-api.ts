import {
  deleteMgrUploadResponseSchema,
  listMgrUploadsResponseSchema,
  uploadMgrUploadResponseSchema,
  type ListMgrUploadsResponse,
} from "../../../../../common/mgr-uploads/mgr-uploads.contracts.js";
import {
  postMultipartAndParseJson,
  requestJson,
} from "../../../common/api/http-client.js";

const MGR_UPLOADS_API_PATH = "/mgr-uploads";

function createMgrUploadFilenamePath(filename: string): string {
  return `${MGR_UPLOADS_API_PATH}/${encodeURIComponent(filename)}`;
}

function createMultipartFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export const mgrUploadsApi = {
  async listFiles(token: string): Promise<ListMgrUploadsResponse> {
    return await requestJson({
      method: "GET",
      path: MGR_UPLOADS_API_PATH,
      responseSchema: listMgrUploadsResponseSchema,
      token,
    });
  },

  async uploadFile(
    token: string,
    file: File,
  ): Promise<ListMgrUploadsResponse["files"][number]> {
    const parsed = await postMultipartAndParseJson({
      formData: createMultipartFormData(file),
      path: MGR_UPLOADS_API_PATH,
      responseSchema: uploadMgrUploadResponseSchema,
      token,
    });
    return parsed.file;
  },

  async deleteFile(token: string, filename: string): Promise<void> {
    await requestJson({
      method: "DELETE",
      path: createMgrUploadFilenamePath(filename),
      responseSchema: deleteMgrUploadResponseSchema,
      token,
    });
  },
};
