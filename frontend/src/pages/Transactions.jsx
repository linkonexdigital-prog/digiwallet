import React, { useEffect, useState } from "react";
import api, { inr } from "@/lib/api";
import { ArrowDownLeft, ArrowUpRight, MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [statusF, setStatusF] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/transactions", { params: { q: q || undefined, type: type || undefined, status: statusF || undefined, limit: 100 } });
      setItems(r.data.items);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setTimeout(load, 350); return () => clearTimeout(id); }, [q, type, statusF]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">All activity</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-2">Search, filter, and review every credit and withdrawal.</p>
      </div>

      <div className="card-flat p-4 flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <input
            data-testid="transactions-search"
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by TXN ID, description"
            className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-foreground"
          />
        </div>
        <select data-testid="transactions-type-filter" value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
          <option value="">All types</option>
          <option value="credit">Credit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="adjustment">Adjustment</option>
          <option value="debit">Debit</option>
          <option value="reversal">Reversal</option>
        </select>
        <select data-testid="transactions-status-filter" value={statusF} onChange={(e) => setStatusF(e.target.value)} className="px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Reference</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-10">No transactions found.</td></tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-md flex items-center justify-center ${t.type === "credit" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                          {t.type === "credit" ? <ArrowDownLeft size={14} weight="bold"/> : <ArrowUpRight size={14} weight="bold"/>}
                        </span>
                        <span className={`pill pill-${t.type}`}>{t.type}</span>
                      </span>
                    </td>
                    <td className="max-w-[260px] truncate">{t.description}</td>
                    <td className={`mono font-bold ${t.type === "credit" ? "text-success" : "text-destructive"}`}>
                      {t.type === "credit" ? "+" : "-"} ₹ {inr(t.amount)}
                    </td>
                    <td><span className={`pill pill-${t.status}`}>{t.status}</span></td>
                    <td className="mono text-xs text-muted-foreground">{t.ref_id || t.external_txn_id || t.id.slice(0, 12)}</td>
                    <td className="mono text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
