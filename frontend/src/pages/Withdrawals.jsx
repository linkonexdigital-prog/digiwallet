import React, { useEffect, useState } from "react";
import api, { inr, fmtErr } from "@/lib/api";
import { Bank, Plus, Trash, ArrowUpRight, CreditCard } from "@phosphor-icons/react";

export default function Withdrawals() {
  const [pms, setPms] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [balance, setBalance] = useState(0);
  const [showAddPM, setShowAddPM] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Add PM form
  const [pmForm, setPmForm] = useState({ type: "upi", upi_id: "", account_holder: "", account_number: "", ifsc: "", bank_name: "" });

  // Withdraw form
  const [wForm, setWForm] = useState({ amount: "", payment_method_id: "" });

  const load = async () => {
    try {
      const [a, b, c] = await Promise.all([
        api.get("/payment-methods"),
        api.get("/withdrawals"),
        api.get("/wallet/summary"),
      ]);
      setPms(a.data); setWithdrawals(b.data); setBalance(c.data.balance);
    } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
  };
  useEffect(() => { load(); }, []);

  const addPM = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api.post("/payment-methods", pmForm);
      setMsg("Payment method added.");
      setPmForm({ type: "upi", upi_id: "", account_holder: "", account_number: "", ifsc: "", bank_name: "" });
      setShowAddPM(false);
      load();
    } catch (e) { setErr(fmtErr(e)); }
  };

  const delPM = async (id) => {
    if (!window.confirm("Delete this payment method?")) return;
    try { await api.delete(`/payment-methods/${id}`); load(); } catch (e) { setErr(fmtErr(e)); }
  };

  const submitWithdraw = async (e) => {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api.post("/withdrawals", { amount: parseFloat(wForm.amount), payment_method_id: wForm.payment_method_id });
      setMsg("Withdrawal submitted for review.");
      setWForm({ amount: "", payment_method_id: "" });
      setShowWithdraw(false);
      load();
    } catch (e) { setErr(fmtErr(e)); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline text-muted-foreground mb-2">Cash out</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Withdrawals</h1>
          <p className="text-sm text-muted-foreground mt-2">Available balance: <span className="mono font-bold text-foreground">₹ {inr(balance)}</span></p>
        </div>
        <button data-testid="withdraw-open-btn" onClick={() => setShowWithdraw(true)} className="px-4 py-2.5 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center gap-2 hover-lift">
          <ArrowUpRight size={16} weight="bold"/> New withdrawal
        </button>
      </div>

      {msg && <div className="mb-4 px-4 py-3 rounded-md text-sm bg-success/10 text-success border border-success/30">{msg}</div>}
      {err && <div className="mb-4 px-4 py-3 rounded-md text-sm bg-destructive/10 text-destructive border border-destructive/30">{err}</div>}

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        {/* Payment Methods */}
        <div className="card-flat">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <div>
              <div className="overline text-muted-foreground">Saved</div>
              <h3 className="font-display text-lg font-bold">Payment methods</h3>
            </div>
            <button data-testid="add-pm-btn" onClick={() => setShowAddPM(!showAddPM)} className="px-3 py-2 rounded-md bg-secondary hover:bg-foreground hover:text-background text-sm font-semibold inline-flex items-center gap-1 transition">
              <Plus size={14} weight="bold"/> Add
            </button>
          </div>
          {showAddPM && (
            <form onSubmit={addPM} className="p-6 border-b border-border space-y-3 bg-surface">
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="radio" className="sr-only peer" checked={pmForm.type === "upi"} onChange={() => setPmForm({ ...pmForm, type: "upi" })}/>
                  <div className="border border-border rounded-md p-3 text-center text-sm font-semibold peer-checked:bg-brand peer-checked:text-brand-foreground transition">UPI</div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input type="radio" className="sr-only peer" checked={pmForm.type === "bank"} onChange={() => setPmForm({ ...pmForm, type: "bank" })}/>
                  <div className="border border-border rounded-md p-3 text-center text-sm font-semibold peer-checked:bg-brand peer-checked:text-brand-foreground transition">Bank</div>
                </label>
              </div>
              {pmForm.type === "upi" ? (
                <input data-testid="pm-upi-input" value={pmForm.upi_id} onChange={(e) => setPmForm({ ...pmForm, upi_id: e.target.value })}
                  placeholder="name@upi" className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm mono" required/>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input value={pmForm.account_holder} onChange={(e) => setPmForm({ ...pmForm, account_holder: e.target.value })} placeholder="Account holder" className="col-span-2 px-3 py-2.5 bg-background border border-border rounded-md text-sm" required/>
                  <input data-testid="pm-account-input" value={pmForm.account_number} onChange={(e) => setPmForm({ ...pmForm, account_number: e.target.value })} placeholder="Account number" className="px-3 py-2.5 bg-background border border-border rounded-md text-sm mono" required/>
                  <input value={pmForm.ifsc} onChange={(e) => setPmForm({ ...pmForm, ifsc: e.target.value.toUpperCase() })} placeholder="IFSC" className="px-3 py-2.5 bg-background border border-border rounded-md text-sm mono" required/>
                  <input value={pmForm.bank_name} onChange={(e) => setPmForm({ ...pmForm, bank_name: e.target.value })} placeholder="Bank name" className="col-span-2 px-3 py-2.5 bg-background border border-border rounded-md text-sm"/>
                </div>
              )}
              <button data-testid="pm-save-btn" type="submit" className="w-full px-4 py-2.5 rounded-md bg-brand text-brand-foreground text-sm font-semibold">Save method</button>
            </form>
          )}

          <div className="divide-y divide-border">
            {pms.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No methods yet. Add one to withdraw.</div>
            ) : pms.map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center">
                  {p.type === "upi" ? <CreditCard size={18}/> : <Bank size={18}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold uppercase tracking-wider">{p.type}</div>
                  <div className="mono text-xs text-muted-foreground truncate">
                    {p.type === "upi" ? p.upi_id : `${p.bank_name || "Bank"} · ${p.account_number?.slice(-4).padStart(p.account_number?.length, "•")} · ${p.ifsc}`}
                  </div>
                </div>
                <button onClick={() => delPM(p.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10">
                  <Trash size={16}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* New withdrawal */}
        {showWithdraw && (
          <div className="card-flat">
            <div className="px-6 py-4 border-b border-border">
              <div className="overline text-muted-foreground">Submit</div>
              <h3 className="font-display text-lg font-bold">New withdrawal</h3>
            </div>
            <form onSubmit={submitWithdraw} className="p-6 space-y-4">
              <div>
                <label className="overline text-muted-foreground block mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground mono">₹</span>
                  <input data-testid="withdraw-amount-input" value={wForm.amount} onChange={(e) => setWForm({ ...wForm, amount: e.target.value })}
                    type="number" min="1" step="0.01" className="w-full pl-9 pr-3 py-3 mono bg-surface border border-border rounded-md text-lg font-bold" required/>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Available: ₹ {inr(balance)}</div>
              </div>
              <div>
                <label className="overline text-muted-foreground block mb-2">Method</label>
                <select data-testid="withdraw-method-select" value={wForm.payment_method_id} onChange={(e) => setWForm({ ...wForm, payment_method_id: e.target.value })}
                  className="w-full px-3 py-3 bg-surface border border-border rounded-md text-sm" required>
                  <option value="">Select a method</option>
                  {pms.map((p) => (
                    <option key={p.id} value={p.id}>{p.type.toUpperCase()} · {p.upi_id || `${p.bank_name || "Bank"} ${p.account_number?.slice(-4)}`}</option>
                  ))}
                </select>
              </div>
              <button data-testid="withdraw-submit-btn" type="submit" className="w-full px-4 py-3 rounded-md bg-brand text-brand-foreground font-semibold hover-lift">
                Submit withdrawal
              </button>
            </form>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card-flat overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="overline text-muted-foreground">History</div>
          <h3 className="font-display text-lg font-bold">Your withdrawals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table-grid w-full">
            <thead>
              <tr>
                <th>Date</th><th>Method</th><th>Details</th><th>Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No withdrawals yet.</td></tr>
              ) : withdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="mono text-xs text-muted-foreground whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
                  <td className="uppercase font-semibold text-sm">{w.method}</td>
                  <td className="mono text-xs text-muted-foreground max-w-[240px] truncate">
                    {w.method === "upi" ? w.payment_details?.upi_id : `${w.payment_details?.bank_name || ""} ${w.payment_details?.account_number?.slice(-4)}`}
                  </td>
                  <td className="mono font-bold">₹ {inr(w.amount)}</td>
                  <td><span className={`pill pill-${w.status}`}>{w.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
