import React, { useEffect, useState } from "react";
import api, { fmtErr } from "@/lib/api";
import { ShieldCheck, SignOut, Warning } from "@phosphor-icons/react";

export default function AdminSecurity() {
  const [logins, setLogins] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = async () => {
    const params = filter === "success" ? { success: true } : filter === "failed" ? { success: false } : {};
    const [a, b] = await Promise.all([api.get("/admin/security/login-logs", { params }), api.get("/admin/security/sessions")]);
    setLogins(a.data); setSessions(b.data);
  };
  useEffect(() => { load(); }, [filter]);

  const forceAll = async () => {
    if (!window.confirm("Force logout ALL non-admin users? They will need to sign in again.")) return;
    try { await api.post("/admin/security/force-logout-all"); setMsg("All sessions forced out."); load(); } catch (e) { setErr(fmtErr(e)); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="flex justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="overline text-muted-foreground mb-2">System</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Security Center</h1>
        </div>
        <button data-testid="security-force-all-btn" onClick={forceAll} className="px-4 py-2.5 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold inline-flex items-center gap-2"><SignOut size={14}/> Force logout all</button>
      </div>

      {msg && <div className="mb-3 text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
      {err && <div className="mb-3 text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-flat overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <div>
              <div className="overline text-muted-foreground">Activity</div>
              <h3 className="font-display text-lg font-bold flex items-center gap-2"><ShieldCheck size={16}/> Login logs</h3>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 bg-surface border border-border rounded-md text-sm">
              <option value="">All</option><option value="success">Success</option><option value="failed">Failed</option>
            </select>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="table-grid w-full">
              <thead><tr><th>Mobile</th><th>IP</th><th>Result</th><th>When</th></tr></thead>
              <tbody>
                {logins.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.mobile_number}</td>
                    <td className="mono text-xs">{l.ip}</td>
                    <td>{l.success ? <span className="pill pill-success">ok</span> : <span className="pill pill-rejected">fail</span>}</td>
                    <td className="mono text-xs">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!logins.length && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No logs.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-flat overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="overline text-muted-foreground">Devices</div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2"><Warning size={16}/> Sessions</h3>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="table-grid w-full">
              <thead><tr><th>User</th><th>IP</th><th>UA</th><th>Active</th><th>When</th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="mono text-xs">{s.user_id?.slice(0, 10)}</td>
                    <td className="mono text-xs">{s.ip}</td>
                    <td className="text-xs text-muted-foreground max-w-[160px] truncate">{s.user_agent}</td>
                    <td>{s.active ? <span className="pill pill-success">yes</span> : <span className="pill pill-rejected">no</span>}</td>
                    <td className="mono text-xs">{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!sessions.length && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No sessions.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
