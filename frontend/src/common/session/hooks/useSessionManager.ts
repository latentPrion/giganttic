import { useAuthSessionContext } from "../context/AuthSessionContext.js";

export function useSessionManager() {
  return useAuthSessionContext();
}
