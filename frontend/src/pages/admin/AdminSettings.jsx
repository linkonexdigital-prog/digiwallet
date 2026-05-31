import React, { useEffect, useState } from "react";
import api, { fmtErr } from "@/lib/api";
import { FloppyDisk, TelegramLogo, Globe, PaperPlaneTilt } from "@phosphor-icons/react";

export default function AdminSettings() {
  const [s, setS] = useState({});
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = async () => {
    const r = await api.get("/admin/settings"); setS(r.data || {});
  };
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e?.preventDefault();
    try { await api.patch("/admin/settings", s); setMsg("Settings saved."); }
    catch (e) { setErr(fmtErr(e)); }
  };

  const testTg = async () => {
    try { await api.post("/admin/settings/telegram/test"); setMsg("Test alert sent to Telegram (if configured)."); }
    catch (e) { setErr(fmtErr(e)); }
  };

  const set = (k, v) => setS({ ...s, [k]: v });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">System</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
      </div>

      {msg && <div className="mb-3 text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
      {err && <div className="mb-3 text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

      <form onSubmit={save} className="space-y-4">
        <div className="card-flat p-6 space-y-3">
          <div className="flex items-center gap-2 mb-2"><Globe size={18}/><h3 className="font-display text-lg font-bold">Branding & SEO</h3></div>
          <Field label="Site name" v={s.site_name} on={(v) => set("site_name", v)} testId="setting-site-name"/>
          <Field label="Logo URL" v={s.logo_url} on={(v) => set("logo_url", v)}/>
          <Field label="Favicon URL" v={s.favicon_url} on={(v) => set("favicon_url", v)}/>
          <Field label="SEO title" v={s.seo_title} on={(v) => set("seo_title", v)}/>
          <Field label="SEO description" v={s.seo_description} on={(v) => set("seo_description", v)} multiline/>
        </div>

        <div className="card-flat p-6 space-y-3">
          <div className="flex items-center gap-2 mb-2"><TelegramLogo size={18}/><h3 className="font-display text-lg font-bold">Telegram alerts</h3></div>
          <label className="flex items-center gap-2 text-sm">
            <input data-testid="setting-tg-enabled" type="checkbox" checked={!!s.telegram_enabled} onChange={(e) => set("telegram_enabled", e.target.checked)}/>
            Enable Telegram alerts
          </label>
          <Field label="Bot token" v={s.telegram_bot_token} on={(v) => set("telegram_bot_token", v)} testId="setting-tg-token" mono/>
          <Field label="Chat ID" v={s.telegram_chat_id} on={(v) => set("telegram_chat_id", v)} mono/>
          <button type="button" onClick={testTg} className="px-4 py-2 rounded-md bg-secondary text-sm font-semibold inline-flex items-center gap-2"><PaperPlaneTilt size={14}/> Send test alert</button>
        </div>

        <div className="card-flat p-6 space-y-3">
          <h3 className="font-display text-lg font-bold">SMTP</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Host" v={s.smtp_host} on={(v) => set("smtp_host", v)}/>
            <Field label="Port" v={s.smtp_port} on={(v) => set("smtp_port", parseInt(v) || 0)} type="number"/>
            <Field label="User" v={s.smtp_user} on={(v) => set("smtp_user", v)}/>
            <Field label="Password" v={s.smtp_password} on={(v) => set("smtp_password", v)} type="password"/>
          </div>
        </div>

        <div className="card-flat p-6 space-y-3">
          <h3 className="font-display text-lg font-bold">System</h3>
          <label className="flex items-center gap-2 text-sm">
            <input data-testid="setting-maintenance" type="checkbox" checked={!!s.maintenance_mode} onChange={(e) => set("maintenance_mode", e.target.checked)}/>
            Maintenance mode (block new users)
          </label>
        </div>

        <button data-testid="settings-save-btn" type="submit" className="px-5 py-3 rounded-md bg-foreground text-background font-semibold inline-flex items-center gap-2"><FloppyDisk size={16}/> Save all changes</button>
      </form>
    </div>
  );
}

const Field = ({ label, v, on, type = "text", multiline, mono, testId }) => (
  <div>
    <label className="overline text-muted-foreground block mb-1">{label}</label>
    {multiline ? (
      <textarea data-testid={testId} value={v || ""} onChange={(e) => on(e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-surface border border-border rounded-md text-sm"/>
    ) : (
      <input data-testid={testId} type={type} value={v ?? ""} onChange={(e) => on(e.target.value)} className={`w-full px-3 py-2.5 bg-surface border border-border rounded-md text-sm ${mono ? "mono" : ""}`}/>
    )}
  </div>
);
