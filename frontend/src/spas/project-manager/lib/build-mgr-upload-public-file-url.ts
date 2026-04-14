import { frontendConfig } from "../../../config/frontend-config.js";

export function buildMgrUploadPublicFileUrl(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `${window.location.origin}${frontendConfig.routePrefix}/mgr-uploads/${encoded}`;
}
