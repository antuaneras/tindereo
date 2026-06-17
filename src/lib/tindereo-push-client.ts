import {
  deleteWebPushSubscription,
  fetchWebPushPublicKey,
  saveWebPushSubscription
} from "@/lib/tindereo-api";

export type WebPushStatus = {
  isStandalone: boolean;
  needsStandaloneInstall: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  supported: boolean;
};

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function supportsPushNotifications() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function base64UrlToUint8Array(value: string) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalizedValue.length % 4 === 0 ? "" : "=".repeat(4 - (normalizedValue.length % 4));
  const binary = window.atob(`${normalizedValue}${padding}`);
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output;
}

async function getServiceWorkerRegistration() {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/"
  });

  return registration;
}

function normalizeSubscriptionPayload(subscription: PushSubscription) {
  const payload = subscription.toJSON();
  if (
    !payload.endpoint ||
    !payload.keys?.auth ||
    !payload.keys?.p256dh
  ) {
    throw new Error("El navegador no ha devuelto una suscripcion push valida.");
  }

  return payload;
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  const standalone = isStandaloneMode();
  const supported = supportsPushNotifications();
  const needsStandaloneInstall = isIosDevice() && !standalone;

  if (!supported || needsStandaloneInstall) {
    return {
      isStandalone: standalone,
      needsStandaloneInstall,
      permission: supported ? Notification.permission : "unsupported",
      subscribed: false,
      supported: supported && !needsStandaloneInstall
    };
  }

  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();

  return {
    isStandalone: standalone,
    needsStandaloneInstall,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    supported: true
  };
}

export async function syncExistingWebPushSubscription() {
  const status = await getWebPushStatus();
  if (!status.supported || status.permission !== "granted") {
    return status;
  }

  const registration = await getServiceWorkerRegistration();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const publicKey = await fetchWebPushPublicKey();
    subscription = await registration.pushManager.subscribe({
      applicationServerKey: base64UrlToUint8Array(publicKey),
      userVisibleOnly: true
    });
  }

  await saveWebPushSubscription(normalizeSubscriptionPayload(subscription));

  return {
    ...status,
    subscribed: true
  } satisfies WebPushStatus;
}

export async function enableWebPushNotifications() {
  const standalone = isStandaloneMode();
  const needsStandaloneInstall = isIosDevice() && !standalone;

  if (!supportsPushNotifications() || needsStandaloneInstall) {
    throw new Error(
      needsStandaloneInstall
        ? "En iPhone primero tienes que anadir Tindereo a la pantalla de inicio y abrirla desde ese acceso directo."
        : "Este navegador no permite notificaciones push."
    );
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Necesitas aceptar los permisos para recibir notificaciones.");
  }

  return syncExistingWebPushSubscription();
}

export async function disableWebPushNotifications() {
  if (!supportsPushNotifications()) {
    return;
  }

  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint ?? null;

  if (endpoint) {
    await deleteWebPushSubscription(endpoint);
  } else {
    await deleteWebPushSubscription();
  }

  if (subscription) {
    await subscription.unsubscribe().catch(() => undefined);
  }
}
