import React, { useEffect, useState } from "react";
import api, { inr } from "@/lib/api";
import { UsersThree, Wallet, ArrowDownLeft, ArrowUpRight, Clock, Lightning } from "@phosphor-icons/react";

const Stat = ({ label, value, sub, icon: Icon, accent, testId }) => (
  <div data-testid={testId} className="card-flat p-5 hover-lift">
    <div className="flex justify-between items-start mb-3">
      <div className="overline text-muted-foreground">{label}</div>
      {Icon && <Icon size={16} className="text-muted-foreground" weight="duotone"/>}
    </div>
    <div className={`mono text-3xl font-bold tracking-tight ${accent || ""}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
  </div>
);

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    let m = true;
    const load = async () => { try { const r = await api.get("/admin/dashboard"); if (m) setD(r.data); } catch (_) {} };
    load(); const i = setInterval(load, 12000); return () => { m = false; clearInterval(i); };
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">Command center</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat testId="admin-stat-users" label="Total Users" value={d?.total_users ?? 0} sub={`${d?.active_users ?? 0} active`} icon={UsersThree}/>
        <Stat testId="admin-stat-balance" label="Total Balance" value={`₹${inr(d?.total_balance)}`} icon={Wallet}/>
        <Stat testId="admin-stat-credits" label="Total Credits" value={`₹${inr(d?.total_credits)}`} accent="text-success" icon={ArrowDownLeft}/>
        <Stat testId="admin-stat-withdrawals" label="Total Withdrawals" value={`₹${inr(d?.total_withdrawals)}`} accent="text-destructive" icon={ArrowUpRight}/>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat testId="admin-stat-pending-wd" label="Pending Withdrawals" value={d?.pending_withdrawals ?? 0} sub="Awaiting review" icon={Clock}/>
        <Stat testId="admin-stat-today" label="Today's Activity" value={d?.today_activity ?? 0} sub="Transactions" icon={Lightning}/>
        <Stat testId="admin-stat-api-today" label="API Requests Today" value={d?.api_requests_today ?? 0} sub="Hits to /api/credit" icon={Lightning}/>
        <Stat testId="admin-stat-fees" label="Wallet Float" value={`₹${inr(d?.total_balance)}`} sub="Liability" icon={Wallet}/>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-flat overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="overline text-muted-foreground">Live</div>
            <h3 className="font-display text-lg font-bold">Recent transactions</h3>
          </div>
          <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
            {(d?.recent_transactions || []).map((t) => (
              <div key={t.id} className="px-6 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs ${t.type === "credit" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {t.type === "credit" ? <ArrowDownLeft size={14}/> : <ArrowUpRight size={14}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{t.description}</div>
                  <div className="mono text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className={`mono text-sm font-bold ${t.type === "credit" ? "text-success" : "text-destructive"}`}>
                  ₹{inr(t.amount)}
                </div>
              </div>
            ))}
            {!d?.recent_transactions?.length && <div className="p-8 text-center text-sm text-muted-foreground">No transactions yet.</div>}
          </div>
        </div>

        <div className="card-flat overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <div className="overline text-muted-foreground">Live</div>
            <h3 className="font-display text-lg font-bold">Recent withdrawals</h3>
          </div>
          <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
            {(d?.recent_withdrawals || []).map((w) => (
              <div key={w.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{w.user_name} <span className="mono text-xs text-muted-foreground">· {w.user_mobile}</span></div>
                  <div className="mono text-xs text-muted-foreground">{w.method?.toUpperCase()} · {new Date(w.created_at).toLocaleString()}</div>
                </div>
                <div className="mono text-sm font-bold">₹{inr(w.amount)}</div>
                <div className={`pill pill-${w.status}`}>{w.status}</div>
              </div>
            ))}
            {!d?.recent_withdrawals?.length && <div className="p-8 text-center text-sm text-muted-foreground">No withdrawals yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
