interface BrowserCrossTabMessage<T> {
  detail: T;
  eventName: string;
}

const channelCache = new Map<string, BroadcastChannel>();

function getChannel(eventName: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  const existing = channelCache.get(eventName);
  if (existing) {
    return existing;
  }

  const created = new BroadcastChannel(`giganttic:${eventName}`);
  channelCache.set(eventName, created);
  return created;
}

export function emitBrowserCrossTabEvent<T>(eventName: string, detail: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
  getChannel(eventName)?.postMessage({ detail, eventName } satisfies BrowserCrossTabMessage<T>);
}

export function subscribeBrowserCrossTabEvent<T>(
  eventName: string,
  handler: (detail: T) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const windowListener = (event: Event): void => {
    const customEvent = event as CustomEvent<T>;
    if (customEvent.detail !== undefined) {
      handler(customEvent.detail);
    }
  };

  window.addEventListener(eventName, windowListener);

  const channel = getChannel(eventName);
  const channelListener = (event: MessageEvent<BrowserCrossTabMessage<T>>): void => {
    if (event.data?.eventName === eventName) {
      handler(event.data.detail);
    }
  };
  channel?.addEventListener("message", channelListener);

  return () => {
    window.removeEventListener(eventName, windowListener);
    channel?.removeEventListener("message", channelListener);
  };
}
