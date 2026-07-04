export interface BrowserWebPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function registerServiceWorker(): void {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Non-critical; the UI reports unsupported/enrollment failures on demand.
    });
  });
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!isWebPushSupported()) {
    throw new Error("Web Push is not supported in this browser");
  }
  await navigator.serviceWorker.register("/service-worker.js");
  return navigator.serviceWorker.ready;
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output.buffer as ArrayBuffer;
}

function subscriptionJson(
  subscription: PushSubscription,
): BrowserWebPushSubscription {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const keys = json.keys;
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error("Browser returned an incomplete push subscription");
  }
  return {
    endpoint,
    expirationTime: json.expirationTime,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
}

export async function subscribeBrowserWebPush(
  publicKey: string,
): Promise<BrowserWebPushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted");
  }
  const registration = await serviceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing !== null) {
    return subscriptionJson(existing);
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(publicKey),
  });
  return subscriptionJson(subscription);
}

export async function unsubscribeBrowserWebPush(): Promise<string | undefined> {
  if (!isWebPushSupported()) return undefined;
  const registration = await serviceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription === null) return undefined;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
