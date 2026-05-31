import React, { useState } from "react";
import api, { fmtErr } from "@/lib/api";
import { Megaphone, PaperPlaneTilt } from "@phosphor-icons/react";

export default function AdminNotifications() {
  const [form, setForm] = useState({ title: "", message: "", target: "all", user_ids: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const send = async (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    try {
      const body = { title: form.title, message: form.message, target: form.target };
      if (form.target === "selected") body.user_ids = form.user_ids.split(",").map((x) => x.trim()).filter(Boolean);
      await api.post("/admin/notifications/broadcast", body);
      setMsg("Broadcast sent.");
      setForm({ title: "", message: "", target: "all", user_ids: "" });
    } catch (e) { setErr(fmtErr(e)); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">Integrations</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Notification Center</h1>
        <p className="text-sm text-muted-foreground mt-2">Send announcements and notifications to your users.</p>
      </div>

      <form onSubmit={send} className="card-flat p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone size={20}/>
          <h3 className="font-display text-lg font-bold">New broadcast</h3>
        </div>

        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer">
            <input type="radio" className="sr-only peer" checked={form.target === "all"} onChange={() => setForm({ ...form, target: "all" })}/>
            <div className="border border-border rounded-md p-3 text-center text-sm font-semibold peer-checked:bg-foreground peer-checked:text-background">All users</div>
          </label>
          <label className="flex-1 cursor-pointer">
            <input type="radio" className="sr-only peer" checked={form.target === "selected"} onChange={() => setForm({ ...form, target: "selected" })}/>
            <div className="border border-border rounded-md p-3 text-center text-sm font-semibold peer-checked:bg-foreground peer-checked:text-background">Selected</div>
          </label>
        </div>

        {form.target === "selected" && (
          <input value={form.user_ids} onChange={(e) => setForm({ ...form, user_ids: e.target.value })} placeholder="Comma-separated user IDs" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md mono text-xs"/>
        )}

        <input data-testid="broadcast-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-sm" required/>
        <textarea data-testid="broadcast-message-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Message" className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-sm" required/>

        {msg && <div className="text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
        {err && <div className="text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

        <button data-testid="broadcast-send-btn" type="submit" className="w-full px-4 py-3 rounded-md bg-foreground text-background font-semibold inline-flex items-center justify-center gap-2">
          <PaperPlaneTilt size={16}/> Send broadcast
        </button>
      </form>
    </div>
  );
}
