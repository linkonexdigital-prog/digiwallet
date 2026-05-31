import React, { useState } from "react";
import api, { fmtErr } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Lock, User as UserIcon } from "@phosphor-icons/react";

export default function Settings() {
  const { user } = useAuth();
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    if (pw.new_password !== pw.confirm) { setErr("New passwords do not match"); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      setMsg("Password updated successfully.");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (e) { setErr(fmtErr(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">Profile</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="card-flat p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-md bg-secondary border border-border flex items-center justify-center"><UserIcon size={24}/></div>
          <div>
            <div className="font-display text-xl font-bold">{user?.full_name}</div>
            <div className="mono text-sm text-muted-foreground">{user?.mobile_number}</div>
            <div className="overline text-muted-foreground mt-1">User · {user?.status}</div>
          </div>
        </div>
      </div>

      <div className="card-flat p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18}/>
          <h3 className="font-display text-lg font-bold">Change password</h3>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input data-testid="settings-current-pw" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
            placeholder="Current password" className="w-full px-4 py-3 bg-surface border border-border rounded-md text-sm" required minLength={6}/>
          <input data-testid="settings-new-pw" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
            placeholder="New password" className="w-full px-4 py-3 bg-surface border border-border rounded-md text-sm" required minLength={6}/>
          <input data-testid="settings-confirm-pw" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            placeholder="Confirm new password" className="w-full px-4 py-3 bg-surface border border-border rounded-md text-sm" required minLength={6}/>
          {msg && <div className="text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
          {err && <div className="text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}
          <button data-testid="settings-save-btn" disabled={busy} type="submit" className="px-5 py-3 rounded-md bg-foreground text-background text-sm font-semibold">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
