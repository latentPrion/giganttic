import { useEffect, useState } from "react";

import { notificationsApi } from "../notifications-api.js";
import { subscribeUserNotificationsStateEvent } from "../user-notifications-state-events.js";

export function useNotificationSummary(token: string) {
  const [unnoticedCount, setUnnoticedCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadSummary(): Promise<void> {
      try {
        const response = await notificationsApi.getNotificationSummary(token);
        if (mounted) {
          setUnnoticedCount(response.unnoticedCount);
        }
      } catch {
        if (mounted) {
          setUnnoticedCount(0);
        }
      }
    }

    void loadSummary();

    return subscribeUserNotificationsStateEvent(() => {
      void loadSummary();
    });
  }, [token]);

  return {
    unnoticedCount,
  };
}
