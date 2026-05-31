import React, { useCallback, useEffect, useState } from "react";
import api, { inr, fmtErr } from "@/lib/api";
import { MagnifyingGlass, Download, ArrowDownLeft, ArrowUpRight, Equals, X, Flag, FloppyDisk, ArrowUUpLeft, Receipt, User as UserIcon } from "@phosphor-icons/react";

const TYPES = ["", "credit", "withdrawal", "debit", "adjustment", "reversal"];

const isOutflow = (type) => type === "withdrawal" || type === "debit";

const typeIconWrap = (type) => {
  if (type === "credit") return "bg-success/10 text-success";
  if (isOutflow(type)) return "bg-destructive/10 text-destructive";
  return "bg-warning/10 text-warning";
};

const typeIcon = (type, size = 12) => {
  if (type === "credit") return <ArrowDownLeft size={size}/>;
  if (isOutflow(type)) return <ArrowUpRight size={size}/>;
  return <Equals size={size}/>;
};

const pillType = (type) => (type === "debit" ? "withdrawal" : type);

const amountColor = (type) => {
  if (type === "credit") return "text-success";
  if (isOutflow(type)) return "text-destructive";
  return "";
};

export default function AdminTransactions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState([]);
  const [filters, setFilters] = useState({ q: "", type: "", status: "", from_date: "", to_date: "", min_amount: "", max_amount: "" });
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      params.limit = 200;
      const r = await api.get("/admin/transactions", { params });
      setItems(r.data.items); setTotal(r.data.total); setSummary(r.data.summary);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [load]);

  const openTx = async (id) => {
    setMsg(""); setErr("");
    setSelectedTx(id);
    const r = await api.get(`/admin/transactions/${id}`);
    setDetail(r.data);
    setEdit({ description: r.data.transaction.description || "", admin_note: r.data.transaction.admin_note || "", flagged: !!r.data.transaction.flagged });
  };

  const saveEdit = async () => {
    try { await api.patch(`/admin/transactions/${selectedTx}`, edit); setMsg("Updated."); load(); openTx(selectedTx); }
    catch (e) { setErr(fmtErr(e)); }
  };

  const reverseTx = async () => {
    if (!window.confirm("Reverse this transaction? This will refund the amount.")) return;
    try { await api.post(`/admin/transactions/${selectedTx}/reverse`); setMsg("Reversed."); load(); openTx(selectedTx); }
    catch (e) { setErr(fmtErr(e)); }
  };

  const exportCsv = () => {
    const u = new URL(`${process.env.REACT_APP_BACKEND_URL}/api/admin/transactions/export`);
    ["type", "status", "from_date", "to_date"].forEach((k) => { if (filters[k]) u.searchParams.set(k, filters[k]); });
    const t = localStorage.getItem("dw_token");
    fetch(u, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.blob()).then((b) => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "transactions.csv"; a.click();
    });
  };

  const totalCredits = summary.find((s) => s._id === "credit")?.total || 0;
  const totalWithdrawals = summary.find((s) => s._id === "withdrawal")?.total || 0;
  const totalAdjustments = summary.find((s) => s._id === "adjustment")?.total || 0;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
        <div>
          <div className="overline text-muted-foreground mb-2">Operations</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-2">Search, filter, audit and manage every wallet transaction.</p>
        </div>
        <button data-testid="tx-export-btn" onClick={exportCsv} className="px-4 py-2.5 rounded-md border border-border hover:bg-secondary text-sm font-semibold inline-flex items-center gap-2"><Download size={14}/> Export CSV</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryStat label="Records" value={total} icon={Receipt} tint="brand"/>
        <SummaryStat label="Credit Volume" value={`₹${inr(totalCredits)}`} icon={ArrowDownLeft} tint="success"/>
        <SummaryStat label="Withdrawal Volume" value={`₹${inr(totalWithdrawals)}`} icon={ArrowUpRight} tint="danger"/>
        <SummaryStat label="Adjustments" value={`₹${inr(totalAdjustments)}`} icon={Equals} tint="warning"/>
      </div>

      {/* Filters */}
      <div className="card-flat p-4 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <input data-testid="tx-search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search ref / txn id / description" className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-md text-sm"/>
        </div>
        <select data-testid="tx-type-filter" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="md:col-span-2 px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
          {TYPES.map((t) => <option key={t || "all"} value={t}>{t ? t.charAt(0).toUpperCase() + t.slice(1) : "All types"}</option>)}
        </select>
        <select data-testid="tx-status-filter" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="md:col-span-2 px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
          <option value="">All statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option>
        </select>
        <input data-testid="tx-from" type="date" value={filters.from_date} onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} className="md:col-span-2 px-3 py-2.5 bg-surface border border-border rounded-md text-sm" title="From date"/>
        <input data-testid="tx-to" type="date" value={filters.to_date} onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} className="md:col-span-2 px-3 py-2.5 bg-surface border border-border rounded-md text-sm" title="To date"/>
        <input data-testid="tx-min" type="number" value={filters.min_amount} onChange={(e) => setFilters({ ...filters, min_amount: e.target.value })} placeholder="Min ₹" className="md:col-span-2 px-3 py-2.5 bg-surface border border-border rounded-md text-sm mono"/>
        <input data-testid="tx-max" type="number" value={filters.max_amount} onChange={(e) => setFilters({ ...filters, max_amount: e.target.value })} placeholder="Max ₹" className="md:col-span-2 px-3 py-2.5 bg-surface border border-border rounded-md text-sm mono"/>
        <button onClick={() => setFilters({ q: "", type: "", status: "", from_date: "", to_date: "", min_amount: "", max_amount: "" })} className="md:col-span-2 px-3 py-2.5 rounded-md bg-secondary text-sm font-semibold">Clear</button>
      </div>

      {/* Table */}
      <div className="card-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Reference</th><th>Type</th><th>User</th><th>Amount</th><th>Status</th><th>Description</th><th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No transactions found.</td></tr>
              : items.map((t) => (
                <tr key={t.id} data-testid={`tx-row-${t.id}`} className={t.flagged ? "bg-warning/5" : ""}>
                  <td className="mono text-xs">
                    {t.flagged && <Flag size={12} className="inline mr-1 text-warning" weight="fill"/>}
                    {t.ref_id || t.id.slice(0, 12)}
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center ${typeIconWrap(t.type)}`}>
                        {typeIcon(t.type)}
                      </span>
                      <span className={`pill pill-${pillType(t.type)}`}>{t.type}</span>
                    </span>
                  </td>
                  <td>
                    <div className="text-sm font-semibold truncate max-w-[140px]">{t.user_name || "—"}</div>
                    <div className="mono text-xs text-muted-foreground">{t.user_mobile || ""}</div>
                  </td>
                  <td className={`mono font-bold ${amountColor(t.type)}`}>₹{inr(t.amount)}</td>
                  <td><span className={`pill pill-${t.status}`}>{t.status}</span></td>
                  <td className="max-w-[200px] truncate text-xs">{t.description}</td>
                  <td className="mono text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td><button onClick={() => openTx(t.id)} className="text-xs font-semibold text-brand hover:underline">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selectedTx && detail && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex justify-end" onClick={() => setSelectedTx(null)}>
          <div className="w-full max-w-2xl h-full overflow-y-auto bg-card border-l border-border" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card z-10">
              <div>
                <div className="overline text-muted-foreground">Transaction</div>
                <h2 className="font-display text-xl font-bold mono">{detail.transaction.ref_id || detail.transaction.id.slice(0, 16)}</h2>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-2 rounded-md hover:bg-secondary"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-5">
              {msg && <div className="text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md">{msg}</div>}
              {err && <div className="text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Amount" value={<span className={`mono text-2xl font-bold ${detail.transaction.type === "credit" ? "text-success" : "text-destructive"}`}>₹{inr(detail.transaction.amount)}</span>}/>
                <DetailRow label="Status" value={<span className={`pill pill-${detail.transaction.status}`}>{detail.transaction.status}</span>}/>
                <DetailRow label="Type" value={<span className="font-semibold capitalize">{detail.transaction.type}</span>}/>
                <DetailRow label="Date" value={<span className="mono text-xs">{new Date(detail.transaction.created_at).toLocaleString()}</span>}/>
              </div>

              {detail.user && (
                <div className="card-flat p-4 bg-surface">
                  <div className="overline text-muted-foreground mb-2">User</div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-brand/15 text-brand flex items-center justify-center"><UserIcon size={18}/></div>
                    <div>
                      <div className="font-semibold">{detail.user.full_name}</div>
                      <div className="mono text-xs text-muted-foreground">{detail.user.mobile_number} · Balance ₹{inr(detail.user.balance)}</div>
                    </div>
                  </div>
                </div>
              )}

              {(detail.transaction.external_txn_id || detail.transaction.order_id) && (
                <div className="card-flat p-4 bg-surface">
                  <div className="overline text-muted-foreground mb-2">External</div>
                  <div className="space-y-1 mono text-xs">
                    {detail.transaction.external_txn_id && <div>TXN ID: <span className="text-foreground">{detail.transaction.external_txn_id}</span></div>}
                    {detail.transaction.api_key_id && <div>API key: <span className="text-foreground">{detail.transaction.api_key_id.slice(0, 12)}…</span></div>}
                    {detail.transaction.gateway_endpoint && <div>Endpoint: <span className="text-foreground">{detail.transaction.gateway_endpoint}</span></div>}
                  </div>
                </div>
              )}

              {detail.related_withdrawal && (
                <div className="card-flat p-4 bg-surface">
                  <div className="overline text-muted-foreground mb-2">Linked withdrawal</div>
                  <div className="text-sm">Method <span className="font-semibold uppercase">{detail.related_withdrawal.method}</span></div>
                  <div className="mono text-xs text-muted-foreground mt-1">{detail.related_withdrawal.payment_details?.upi_id || detail.related_withdrawal.payment_details?.account_number}</div>
                </div>
              )}

              {detail.admin && (
                <div className="card-flat p-4 bg-surface">
                  <div className="overline text-muted-foreground mb-2">Processed by admin</div>
                  <div className="text-sm font-semibold">{detail.admin.full_name}</div>
                </div>
              )}

              <div className="card-flat p-4 space-y-3">
                <div className="overline text-muted-foreground">Edit</div>
                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <input value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="mt-1 w-full px-3 py-2 bg-surface border border-border rounded-md text-sm"/>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Admin note (internal)</label>
                  <textarea value={edit.admin_note || ""} onChange={(e) => setEdit({ ...edit, admin_note: e.target.value })} rows={2} className="mt-1 w-full px-3 py-2 bg-surface border border-border rounded-md text-sm"/>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!edit.flagged} onChange={(e) => setEdit({ ...edit, flagged: e.target.checked })}/>
                  <Flag size={14} className="text-warning" weight={edit.flagged ? "fill" : "regular"}/>
                  Flag as suspicious
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button data-testid="tx-save-btn" onClick={saveEdit} className="px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center gap-2"><FloppyDisk size={14}/> Save</button>
                  {(detail.transaction.type === "credit" || detail.transaction.type === "debit") && !detail.transaction.reversed && (
                    <button data-testid="tx-reverse-btn" onClick={reverseTx} className="px-4 py-2 rounded-md bg-destructive/10 text-destructive text-sm font-semibold inline-flex items-center gap-2"><ArrowUUpLeft size={14}/> Reverse</button>
                  )}
                  {detail.transaction.reversed && <span className="pill pill-rejected">Already reversed</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SummaryStat = ({ label, value, icon: Icon, tint }) => (
  <div className="card-flat p-4 relative overflow-hidden">
    {tint && <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-50 ${tint === "success" ? "bg-success/30" : tint === "danger" ? "bg-destructive/20" : tint === "brand" ? "bg-brand/25" : "bg-warning/20"}`}/>}
    <div className="flex justify-between items-start relative">
      <div className="overline text-muted-foreground">{label}</div>
      {Icon && <Icon size={14} weight="duotone"/>}
    </div>
    <div className="mono text-2xl font-bold mt-2 relative">{value}</div>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="card-flat p-3 bg-surface">
    <div className="overline text-muted-foreground mb-1.5">{label}</div>
    <div>{value}</div>
  </div>
);
