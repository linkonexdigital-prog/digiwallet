import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

/**
 * Background notification poller. Watches for NEW notifications and:
 *  - shows in-app toast (sonner)
 *  - fires native Browser Notification (if permission granted)
 * Returns: { unread, requestPermission, permission }
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

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.get("/notifications", { params: { limit: 20 } });
        if (!alive) return;
        const items = r.data.items || [];
        setUnread(r.data.unread || 0);
        // First tick: seed seen set without firing toasts
        if (!initialized.current) {
          items.forEach((n) => seenIds.current.add(n.id));
          initialized.current = true;
          return;
        }
        // Newer first; iterate oldest-of-the-new first
        const fresh = items.filter((n) => !seenIds.current.has(n.id)).reverse();
        fresh.forEach((n) => {
          seenIds.current.add(n.id);
          // toast
          const fn = n.type === "success" ? toast.success
                    : n.type === "warning" ? toast.warning
                    : n.type === "error" ? toast.error
                    : toast;
          fn(n.title, { description: n.message, duration: 6000 });
          // browser notification
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              const bn = new Notification(n.title, {
                body: n.message,
                tag: n.id,
                icon: "/favicon.ico",
                silent: false,
              });
              bn.onclick = () => { window.focus(); };
            } catch (_) {}
          }
        });
      } catch (_) {}
    };
    tick();
    const i = setInterval(tick, 10000);
    return () => { alive = false; clearInterval(i); };
  }, [enabled]);

  return { unread, requestPermission, permission };
}
