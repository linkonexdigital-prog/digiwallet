import api from "@/lib/api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

let registrationPromise = null;

export async function ensureSWRegistered() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("/sw.js").catch(() => null);
  }
  return await registrationPromise;
}

export async function subscribeForPush() {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  const reg = await ensureSWRegistered();
  if (!reg) return { ok: false, reason: "no-sw" };
  await navigator.serviceWorker.ready;

  // Get VAPID key
  let publicKey = "";
  try {
    const r = await api.get("/push/public-key");
    publicKey = r.data.public_key;
  } catch (_) { return { ok: false, reason: "vapid-fetch-failed" }; }

  let sub;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
  } catch (e) {
    return { ok: false, reason: "subscribe-failed", error: e.message };
  }

  try {
    await api.post("/push/subscribe", { subscription: sub.toJSON(), user_agent: navigator.userAgent });
  } catch (e) {
    return { ok: false, reason: "save-failed", error: e.message };
  }
  return { ok: true, subscription: sub };
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return { ok: false };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: true };
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try { await api.post("/push/unsubscribe", { subscription: sub.toJSON() }); } catch (_) {}
    try { await sub.unsubscribe(); } catch (_) {}
  }
  return { ok: true };
}

export async function getPushStatus() {
  if (typeof Notification === "undefined") return { supported: false, permission: "denied", subscribed: false };
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return { supported: false, permission: Notification.permission, subscribed: false };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      subscribed = !!sub;
    }
  } catch (_) {}
  return { supported: true, permission: Notification.permission, subscribed };
}

export async function sendTestPush() {
  return api.post("/push/test");
}
