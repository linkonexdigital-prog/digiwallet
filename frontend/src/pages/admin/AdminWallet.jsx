import React, { useEffect, useState } from "react";
import api, { inr, fmtErr } from "@/lib/api";
import { ArrowDownLeft, ArrowUpRight, Equals, ArrowUUpLeft } from "@phosphor-icons/react";

export default function AdminWallet() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  const [op, setOp] = useState("credit");
  const [amount, setAmount] = useState("");
  const [newBal, setNewBal] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [txs, setTxs] = useState([]);

  const loadUsers = async () => {
    const r = await api.get("/admin/users", { params: { q: q || undefined, limit: 30 } });
    setUsers(r.data.items);
  };
  useEffect(() => { const id = setTimeout(loadUsers, 300); return () => clearTimeout(id); }, [q]);

  const loadTx = async (uid) => {
    const r = await api.get(`/admin/users/${uid}`);
    setTxs(r.data.recent_transactions);
  };

  const submit = async () => {
    setMsg(""); setErr("");
    try {
      if (op === "credit") await api.post("/admin/wallet/credit", { user_id: target.id, amount: parseFloat(amount), note });
      else if (op === "debit") await api.post("/admin/wallet/debit", { user_id: target.id, amount: parseFloat(amount), note });
      else if (op === "adjust") await api.post("/admin/wallet/adjust", { user_id: target.id, new_balance: parseFloat(newBal), note });
      setMsg(`Wallet ${op} done.`); setAmount(""); setNewBal(""); setNote(""); loadUsers(); loadTx(target.id);
      const r = await api.get(`/admin/users/${target.id}`); setTarget(r.data.user);
    } catch (e) { setErr(fmtErr(e)); }
  };

  const reverse = async (tid) => {
    if (!window.confirm("Reverse this transaction?")) return;
    try { await api.post(`/admin/transactions/${tid}/reverse`); setMsg("Reversed."); loadTx(target.id); }
    catch (e) { setErr(fmtErr(e)); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">Operations</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Wallet operations</h1>
        <p className="text-sm text-muted-foreground mt-2">Manual credit, debit, adjust balance, reverse transactions.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-flat">
          <div className="px-5 py-4 border-b border-border">
            <input data-testid="wallet-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a user…" className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm"/>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {users.map((u) => (
              <button key={u.id} data-testid={`wallet-select-${u.mobile_number}`} onClick={() => { setTarget(u); loadTx(u.id); }}
                className={`w-full text-left px-5 py-3 flex justify-between items-center hover:bg-surface transition ${target?.id === u.id ? "bg-surface" : ""}`}>
                <div>
                  <div className="font-semibold text-sm">{u.full_name}</div>
                  <div className="mono text-xs text-muted-foreground">{u.mobile_number}</div>
                </div>
                <div className="mono font-bold">₹{inr(u.balance)}</div>
              </button>
            ))}
            {!users.length && <div className="p-6 text-center text-sm text-muted-foreground">No users.</div>}
          </div>
        </div>

        {target ? (
          <div className="card-flat">
            <div className="px-5 py-4 border-b border-border">
              <div className="overline text-muted-foreground">Selected</div>
              <div className="font-display text-xl font-bold">{target.full_name}</div>
              <div className="mono text-xs text-muted-foreground">{target.mobile_number}</div>
              <div className="mono text-2xl font-bold mt-2">₹{inr(target.balance)}</div>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: "credit", l: "Credit", i: ArrowDownLeft },
                  { k: "debit", l: "Debit", i: ArrowUpRight },
                  { k: "adjust", l: "Adjust", i: Equals },
                ].map((o) => (
                  <button key={o.k} data-testid={`wallet-op-${o.k}`} onClick={() => setOp(o.k)}
                    className={`p-3 rounded-md border text-sm font-semibold flex items-center justify-center gap-2 transition ${op === o.k ? "bg-brand text-brand-foreground border-foreground" : "border-border hover:bg-secondary"}`}>
                    <o.i size={14}/> {o.l}
                  </button>
                ))}
              </div>
              {op !== "adjust" ? (
                <input data-testid="wallet-amount-input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full px-3 py-3 bg-surface border border-border rounded-md mono text-lg"/>
              ) : (
                <input data-testid="wallet-newbal-input" type="number" min="0" step="0.01" value={newBal} onChange={(e) => setNewBal(e.target.value)} placeholder="New balance" className="w-full px-3 py-3 bg-surface border border-border rounded-md mono text-lg"/>
              )}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" rows={2} className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm"/>
              {msg && <div className="text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
              {err && <div className="text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}
              <button data-testid="wallet-submit-btn" onClick={submit} className="w-full px-4 py-3 rounded-md bg-brand text-brand-foreground font-semibold">
                Execute {op}
              </button>
            </div>
          </div>
        ) : (
          <div className="card-flat p-10 text-center text-sm text-muted-foreground">Select a user to manage their wallet.</div>
        )}
      </div>

      {target && (
        <div className="card-flat mt-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="overline text-muted-foreground">Transactions for {target.full_name}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="table-grid w-full">
              <thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td><span className={`pill pill-${t.type}`}>{t.type}</span></td>
                    <td className="max-w-[260px] truncate">{t.description}</td>
                    <td className={`mono font-bold ${t.type === "credit" ? "text-success" : "text-destructive"}`}>₹{inr(t.amount)}</td>
                    <td><span className={`pill pill-${t.status}`}>{t.status}</span></td>
                    <td className="mono text-xs">{new Date(t.created_at).toLocaleString()}</td>
                    <td>{(t.type === "credit" || t.type === "debit") && !t.reversed && <button onClick={() => reverse(t.id)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowUUpLeft size={12}/> Reverse</button>}</td>
                  </tr>
                ))}
                {!txs.length && <tr><td colSpan={6} className="text-center text-muted-foreground py-6">No transactions.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
