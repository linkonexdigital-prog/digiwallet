import React, { useEffect, useState } from "react";
import api, { inr, fmtErr } from "@/lib/api";
import { Download, Check, X as XIcon, Money } from "@phosphor-icons/react";

const STATUSES = ["", "pending", "approved", "paid", "rejected"];

export default function AdminWithdrawals() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = async () => {
    const r = await api.get("/admin/withdrawals", { params: { status: status || undefined, q: q || undefined, limit: 200 } });
    setItems(r.data.items); setSelected([]);
  };
  useEffect(() => { load(); }, [status]);
  useEffect(() => { const id = setTimeout(load, 350); return () => clearTimeout(id); }, [q]);

  const action = async (id, act) => {
    setErr(""); setMsg("");
    try {
      const note = act === "reject" ? (window.prompt("Reason (optional):") || "") : "";
      await api.post(`/admin/withdrawals/${id}/${act}`, { note });
      setMsg(`Marked ${act}.`); load();
    } catch (e) { setErr(fmtErr(e)); }
  };

  const bulk = async (act) => {
    if (selected.length === 0) return;
    if (!window.confirm(`Apply '${act}' to ${selected.length} withdrawals?`)) return;
    try {
      await api.post(`/admin/withdrawals/bulk`, { ids: selected, action: act });
      setMsg(`Bulk ${act} done.`); load();
    } catch (e) { setErr(fmtErr(e)); }
  };

  const exportCsv = () => {
    const u = new URL(`${process.env.REACT_APP_BACKEND_URL}/api/admin/withdrawals/export`);
    if (status) u.searchParams.set("status", status);
    const t = localStorage.getItem("dw_token");
    fetch(u, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.blob()).then((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "withdrawals.csv"; a.click();
    });
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="flex justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline text-muted-foreground mb-2">Operations</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Withdrawals</h1>
        </div>
        <button data-testid="wd-export-btn" onClick={exportCsv} className="px-4 py-2.5 rounded-md border border-border hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"><Download size={14}/> Export CSV</button>
      </div>

      <div className="card-flat p-4 flex flex-wrap items-center gap-3 mb-4">
        <input data-testid="wd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user / mobile / id" className="flex-1 min-w-[200px] px-3 py-2.5 bg-surface border border-border rounded-md text-sm"/>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s || "all"} data-testid={`wd-status-${s || "all"}`} onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition ${status === s ? "bg-brand text-brand-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {s || "all"}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="mb-3 text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
      {err && <div className="mb-3 text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

      {selected.length > 0 && (
        <div className="card-flat p-3 flex flex-wrap gap-2 items-center mb-3">
          <span className="text-sm font-semibold mr-3">{selected.length} selected</span>
          <button onClick={() => bulk("approve")} className="px-3 py-2 text-sm font-semibold rounded-md bg-success/10 text-success">Approve</button>
          <button onClick={() => bulk("paid")} className="px-3 py-2 text-sm font-semibold rounded-md bg-brand text-brand-foreground">Mark paid</button>
          <button onClick={() => bulk("reject")} className="px-3 py-2 text-sm font-semibold rounded-md bg-destructive/10 text-destructive">Reject</button>
        </div>
      )}

      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th><input type="checkbox" checked={selected.length > 0 && selected.length === items.length} onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}/></th>
                <th>Date</th><th>User</th><th>Method</th><th>Details</th><th>Amount</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td><input type="checkbox" checked={selected.includes(w.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, w.id] : selected.filter((x) => x !== w.id))}/></td>
                  <td className="mono text-xs whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
                  <td>
                    <div className="font-semibold text-sm">{w.user_name}</div>
                    <div className="mono text-xs text-muted-foreground">{w.user_mobile}</div>
                  </td>
                  <td className="uppercase font-semibold">{w.method}</td>
                  <td className="mono text-xs max-w-[200px] truncate">
                    {w.method === "upi" ? w.payment_details?.upi_id : `${w.payment_details?.bank_name || ""} · ${w.payment_details?.account_number}`}
                  </td>
                  <td className="mono font-bold">₹{inr(w.amount)}</td>
                  <td><span className={`pill pill-${w.status}`}>{w.status}</span></td>
                  <td>
                    <div className="flex gap-1">
                      {w.status === "pending" && <button data-testid={`wd-approve-${w.id}`} onClick={() => action(w.id, "approve")} className="p-1.5 rounded-md bg-success/10 text-success hover:bg-success/20" title="Approve"><Check size={14}/></button>}
                      {(w.status === "pending" || w.status === "approved") && <button data-testid={`wd-paid-${w.id}`} onClick={() => action(w.id, "paid")} className="p-1.5 rounded-md bg-brand text-brand-foreground hover:opacity-90" title="Mark paid"><Money size={14}/></button>}
                      {(w.status === "pending" || w.status === "approved") && <button data-testid={`wd-reject-${w.id}`} onClick={() => action(w.id, "reject")} className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20" title="Reject"><XIcon size={14}/></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No withdrawals.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
