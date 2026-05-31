import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { inr, fmtErr } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { MagnifyingGlass, X, Snowflake, Sun, KeyReturn, SignIn, FloppyDisk } from "@phosphor-icons/react";

export default function AdminUsers() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const { loginAs } = useAuth();
  const nav = useNavigate();

  const load = async () => {
    const r = await api.get("/admin/users", { params: { q: q || undefined, status: status || undefined, limit: 100 } });
    setItems(r.data.items);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setTimeout(load, 350); return () => clearTimeout(id); }, [q, status]);

  const openUser = async (id) => {
    setSelected(id); setMsg(""); setErr("");
    const r = await api.get(`/admin/users/${id}`);
    setDetail(r.data);
    setEdit({ full_name: r.data.user.full_name, status: r.data.user.status, wallet_frozen: r.data.user.wallet_frozen, internal_notes: r.data.user.internal_notes || "" });
  };

  const saveEdit = async () => {
    setErr(""); setMsg("");
    try { await api.patch(`/admin/users/${selected}`, edit); setMsg("Saved."); load(); openUser(selected); } catch (e) { setErr(fmtErr(e)); }
  };

  const resetPw = async () => {
    const np = window.prompt("New password (min 6 chars):");
    if (!np) return;
    try { await api.patch(`/admin/users/${selected}`, { new_password: np }); setMsg("Password reset."); } catch (e) { setErr(fmtErr(e)); }
  };

  const loginAsUser = async () => {
    try {
      const r = await api.post(`/admin/users/${selected}/login-as`);
      loginAs(r.data.token, r.data.user);
      nav("/app");
    } catch (e) { setErr(fmtErr(e)); }
  };

  const forceLogout = async () => {
    try { await api.post(`/admin/users/${selected}/force-logout`); setMsg("All sessions forced out."); } catch (e) { setErr(fmtErr(e)); }
  };

  const adjustBalance = async (mode) => {
    const amt = window.prompt(`Amount to ${mode}:`);
    if (!amt) return;
    const note = window.prompt("Note (optional):") || "";
    try {
      await api.post(`/admin/wallet/${mode}`, { user_id: selected, amount: parseFloat(amt), note });
      setMsg(`Wallet ${mode}ed.`); openUser(selected); load();
    } catch (e) { setErr(fmtErr(e)); }
  };

  const freeze = async (state) => {
    try {
      await api.post(`/admin/wallet/${selected}/${state ? "freeze" : "unfreeze"}`);
      setMsg(`Wallet ${state ? "frozen" : "unfrozen"}.`); openUser(selected); load();
    } catch (e) { setErr(fmtErr(e)); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">Operations</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Users</h1>
      </div>

      <div className="card-flat p-4 flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <input data-testid="admin-users-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile, ID" className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-md text-sm"/>
        </div>
        <select data-testid="admin-users-status-filter" value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Name</th><th>Mobile</th><th>Balance</th><th>Status</th><th>Wallet</th><th>Joined</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} data-testid={`admin-user-row-${u.mobile_number}`}>
                  <td className="font-semibold">{u.full_name}</td>
                  <td className="mono">{u.mobile_number}</td>
                  <td className="mono font-bold">₹ {inr(u.balance)}</td>
                  <td><span className={`pill pill-${u.status}`}>{u.status}</span></td>
                  <td>{u.wallet_frozen ? <span className="pill pill-rejected">Frozen</span> : <span className="pill pill-active">OK</span>}</td>
                  <td className="mono text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td><button onClick={() => openUser(u.id)} className="text-sm font-semibold underline">Manage</button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && detail && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl h-full overflow-y-auto bg-card border-l border-border" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card z-10">
              <div>
                <div className="overline text-muted-foreground">User</div>
                <h2 className="font-display text-xl font-bold">{detail.user.full_name}</h2>
                <div className="mono text-xs text-muted-foreground">{detail.user.mobile_number} · {detail.user.id.slice(0, 8)}</div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-md hover:bg-secondary"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-6">
              {msg && <div className="text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
              {err && <div className="text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

              <div className="grid grid-cols-3 gap-3">
                <div className="card-flat p-4">
                  <div className="overline text-muted-foreground">Balance</div>
                  <div className="mono text-2xl font-bold mt-1">₹{inr(detail.user.balance)}</div>
                </div>
                <div className="card-flat p-4">
                  <div className="overline text-muted-foreground">Status</div>
                  <div className="text-base font-semibold mt-1">{detail.user.status}</div>
                </div>
                <div className="card-flat p-4">
                  <div className="overline text-muted-foreground">Wallet</div>
                  <div className="text-base font-semibold mt-1">{detail.user.wallet_frozen ? "Frozen" : "Active"}</div>
                </div>
              </div>

              <div className="card-flat p-4 space-y-3">
                <div className="overline text-muted-foreground">Edit</div>
                <input value={edit.full_name || ""} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm"/>
                <select value={edit.status || "active"} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm">
                  <option value="active">Active</option><option value="suspended">Suspended</option><option value="banned">Banned</option>
                </select>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!edit.wallet_frozen} onChange={(e) => setEdit({ ...edit, wallet_frozen: e.target.checked })}/>
                  Freeze wallet
                </label>
                <textarea value={edit.internal_notes || ""} onChange={(e) => setEdit({ ...edit, internal_notes: e.target.value })} placeholder="Internal notes" rows={3} className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm"/>
                <button data-testid="admin-user-save-btn" onClick={saveEdit} className="px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center gap-2"><FloppyDisk size={14}/> Save changes</button>
              </div>

              <div className="card-flat p-4">
                <div className="overline text-muted-foreground mb-3">Wallet ops</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => adjustBalance("credit")} className="px-3 py-2 rounded-md bg-success/10 text-success text-sm font-semibold">Manual credit</button>
                  <button onClick={() => adjustBalance("debit")} className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm font-semibold">Manual debit</button>
                  {!detail.user.wallet_frozen ? (
                    <button onClick={() => freeze(true)} className="px-3 py-2 rounded-md bg-secondary text-sm font-semibold inline-flex items-center gap-2"><Snowflake size={14}/> Freeze</button>
                  ) : (
                    <button onClick={() => freeze(false)} className="px-3 py-2 rounded-md bg-secondary text-sm font-semibold inline-flex items-center gap-2"><Sun size={14}/> Unfreeze</button>
                  )}
                </div>
              </div>

              <div className="card-flat p-4">
                <div className="overline text-muted-foreground mb-3">Security</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={resetPw} className="px-3 py-2 rounded-md bg-secondary text-sm font-semibold inline-flex items-center gap-2"><KeyReturn size={14}/> Reset password</button>
                  <button onClick={forceLogout} className="px-3 py-2 rounded-md bg-secondary text-sm font-semibold">Force logout</button>
                  <button data-testid="admin-login-as-btn" onClick={loginAsUser} className="col-span-2 px-3 py-2 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center justify-center gap-2"><SignIn size={14}/> Login as user</button>
                </div>
              </div>

              <div className="card-flat p-4">
                <div className="overline text-muted-foreground mb-3">Login history</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detail.login_history.map((l) => (
                    <div key={l.id} className="text-xs flex justify-between gap-2 py-1.5 border-b border-border last:border-b-0">
                      <span className="mono">{l.ip}</span>
                      <span className={l.success ? "text-success" : "text-destructive"}>{l.success ? "OK" : "FAIL"}</span>
                      <span className="mono text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {!detail.login_history.length && <div className="text-xs text-muted-foreground">No logins yet.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
