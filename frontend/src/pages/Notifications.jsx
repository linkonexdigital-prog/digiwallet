import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell, CheckCircle, Info, Warning } from "@phosphor-icons/react";

const iconFor = (t) => {
  if (t === "success") return CheckCircle;
  if (t === "warning") return Warning;
  return Info;
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    const r = await api.get("/notifications", { params: { limit: 100 } });
    setItems(r.data.items); setUnread(r.data.unread);
  };
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post("/notifications/read");
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto fade-up">
      <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
        <div>
          <div className="overline text-muted-foreground mb-2">Inbox</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-2">{unread > 0 ? `${unread} unread` : "All caught up."}</p>
        </div>
        <button data-testid="mark-all-read-btn" onClick={markAll} className="px-4 py-2.5 rounded-md bg-secondary hover:bg-foreground hover:text-background text-sm font-semibold transition">
          Mark all read
        </button>
      </div>

      <div className="card-flat divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-16 text-center">
            <Bell size={36} className="mx-auto mb-3 text-muted-foreground opacity-50"/>
            <div className="text-sm text-muted-foreground">No notifications yet.</div>
          </div>
        ) : items.map((n) => {
          const Ic = iconFor(n.type);
          return (
            <div key={n.id} className={`px-6 py-4 flex items-start gap-4 ${!n.read ? "bg-surface" : ""}`}>
              <div className={`w-10 h-10 shrink-0 rounded-md flex items-center justify-center border border-border ${n.type === "success" ? "text-success" : n.type === "warning" ? "text-warning" : "text-foreground"}`}>
                <Ic size={18} weight="duotone"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3">
                  <div className="font-semibold text-sm">{n.title}</div>
                  <div className="mono text-xs text-muted-foreground whitespace-nowrap">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{n.message}</div>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-foreground mt-2"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
