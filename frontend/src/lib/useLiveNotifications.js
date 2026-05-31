import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { ensureSWRegistered } from "@/lib/webPush";

/**
 * Powerful live notification poller.
 *  - NO in-app toast (user explicitly disabled).
 *  - Fires native browser/OS notification via Service Worker (so it works in background).
 *  - Falls back to plain Notification API when SW not available.
 *  - Auto-requests permission once on first visit.
 *  - 5s polling for near-real-time delivery.
 *  - Plays a subtle sound on every new alert.
 *  - Marks notifications as requireInteraction so they don't auto-dismiss.
 */
export function useLiveNotifications(enabled = true) {
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const seenIds = useRef(new Set());
  const initialized = useRef(false);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission === "granted") { setPermission("granted"); return "granted"; }
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  };

  // Simple WebAudio ping (subtle confirm sound)
  const playPing = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ac = new Ctx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.35);
      o.start(); o.stop(ac.currentTime + 0.4);
      setTimeout(() => {
        try { ac.close(); }
        catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw] audio close", e); }
      }, 600);
    } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
  }, []);

  const showNotification = useCallback(async (n) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const opts = {
      body: n.message,
      tag: n.id,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: "/app/notifications", id: n.id },
    };
    // Prefer SW (works even when tab is in background)
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(n.title, opts);
        playPing();
        return;
      }
    } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
    // Fallback: page-level notification
    try {
      const bn = new Notification(n.title, opts);
      bn.onclick = () => { window.focus(); window.location.href = "/app/notifications"; };
      playPing();
    } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
  }, [playPing]);

  // Ensure SW is registered ASAP
  useEffect(() => { ensureSWRegistered(); }, []);

  // Auto-request permission once
  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("dw_perm_asked") === "1") return;
    const t = setTimeout(async () => {
      localStorage.setItem("dw_perm_asked", "1");
      await requestPermission();
    }, 1500);
    return () => clearTimeout(t);
  }, [enabled]);

  // Polling
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.get("/notifications", { params: { limit: 25 } });
        if (!alive) return;
        const items = r.data.items || [];
        setUnread(r.data.unread || 0);
        if (!initialized.current) {
          items.forEach((n) => seenIds.current.add(n.id));
          initialized.current = true;
          return;
        }
        const fresh = items.filter((n) => !seenIds.current.has(n.id)).reverse();
        for (const n of fresh) {
          seenIds.current.add(n.id);
          await showNotification(n);
        }
      } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
    };
    tick();
    const i = setInterval(tick, 5000); // 5s for near-real-time
    return () => { alive = false; clearInterval(i); };
  }, [enabled, showNotification]);

  return { unread, requestPermission, permission };
}
