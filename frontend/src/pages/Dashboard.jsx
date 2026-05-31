import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { inr } from "@/lib/api";
import { ArrowUpRight, ArrowDownLeft, Clock, Bank, Lightning, Wallet, EyeSlash, Eye } from "@phosphor-icons/react";

const StatCard = ({ label, value, sub, accent, testId, icon: Icon, tint }) => (
  <div data-testid={testId} className={`card-flat p-6 hover-lift relative overflow-hidden ${tint || ""}`}>
    {tint && <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-50 ${tint === "tint-success" ? "bg-success/20" : tint === "tint-danger" ? "bg-destructive/15" : "bg-warning/15"}`}/>}
    <div className="flex items-start justify-between mb-3 relative">
      <div className="overline text-muted-foreground">{label}</div>
      {Icon && <Icon size={16} className="text-muted-foreground" weight="duotone"/>}
    </div>
    <div className={`mono text-3xl md:text-4xl font-bold tracking-tight relative ${accent || ""}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-2 relative">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [tx, setTx] = useState([]);
  const [show, setShow] = useState(true);

  const load = async () => {
    try {
      const [a, b] = await Promise.all([
        api.get("/wallet/summary"),
        api.get("/transactions", { params: { limit: 6 } }),
      ]);
      setS(a.data); setTx(b.data.items);
    } catch (e) {}
  };
  useEffect(() => { load(); const i = setInterval(load, 12000); return () => clearInterval(i); }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline text-muted-foreground mb-2">Overview</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Your wallet at a glance.</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/app/withdrawals" data-testid="dashboard-withdraw-btn" className="px-4 py-2.5 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center gap-2 hover-lift shadow-lg shadow-brand/20">
            <ArrowUpRight size={16} weight="bold"/> Withdraw
          </Link>
        </div>
      </div>

      {/* Hero balance */}
      <div className="card-flat p-6 md:p-8 mb-6 relative overflow-hidden bg-gradient-to-br from-card via-card to-brand/5">
        <div className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-brand/[0.08] blur-3xl pointer-events-none"/>
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-brand/[0.04] blur-3xl pointer-events-none"/>
        <div className="flex flex-wrap justify-between items-start gap-6 relative">
          <div className="flex-1">
            <div className="overline text-muted-foreground mb-3 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"/><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand"/></span>
              Available Balance {s?.wallet_frozen && <span className="ml-2 pill pill-rejected">FROZEN</span>}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl md:text-4xl text-muted-foreground">₹</span>
              <span data-testid="dashboard-balance" className="mono text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-brand bg-clip-text text-transparent">
                {show ? inr(s?.balance) : "•••••"}
              </span>
              <button onClick={() => setShow(!show)} className="ml-2 text-muted-foreground hover:text-foreground p-2 transition">
                {show ? <EyeSlash size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            <div className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
              <Lightning size={14} weight="duotone"/>
              Live · updated {new Date().toLocaleTimeString()}
            </div>
          </div>
          <div className="w-14 h-14 rounded-md bg-gradient-to-br from-brand to-brand/70 text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/20">
            <Wallet size={26} weight="duotone"/>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard testId="stat-credits" label="Total Credits" value={`₹ ${inr(s?.total_credits)}`} accent="text-success" sub="Lifetime received" icon={ArrowDownLeft} tint="tint-success"/>
        <StatCard testId="stat-withdrawals" label="Total Withdrawals" value={`₹ ${inr(s?.total_withdrawals)}`} accent="text-destructive" sub="Paid out" icon={ArrowUpRight} tint="tint-danger"/>
        <StatCard testId="stat-pending" label="Pending Withdrawals" value={s?.pending_withdrawals_count ?? 0} sub={`₹ ${inr(s?.pending_withdrawals_amount)} in review`} icon={Clock} tint="tint-warning"/>
      </div>

      {/* Recent transactions */}
      <div className="card-flat overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <div className="overline text-muted-foreground">Activity</div>
            <h3 className="font-display text-lg font-bold">Recent transactions</h3>
          </div>
          <Link to="/app/transactions" data-testid="dashboard-view-all-txn" className="text-sm font-semibold text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        {tx.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Lightning size={28} className="mx-auto mb-3 opacity-50"/>
            <div className="text-sm">No transactions yet. Once your wallet receives a credit, it will appear here.</div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tx.map((t) => (
              <div key={t.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface transition">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${t.type === "credit" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {t.type === "credit" ? <ArrowDownLeft size={18} weight="bold"/> : <ArrowUpRight size={18} weight="bold"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{t.description || t.type}</div>
                  <div className="mono text-xs text-muted-foreground truncate">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`mono font-bold ${t.type === "credit" ? "text-success" : "text-destructive"}`}>
                    {t.type === "credit" ? "+" : "-"} ₹ {inr(t.amount)}
                  </div>
                  <div className={`pill pill-${t.status} mt-1`}>{t.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
