import React from "react";
import { Link } from "react-router-dom";
import { Wallet, ArrowRight, ShieldCheck, Lightning, ChartBar, BellRinging, CheckCircle } from "@phosphor-icons/react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 px-6 lg:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-foreground text-background flex items-center justify-center">
            <Wallet size={20} weight="duotone" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">DigiWallet<span className="text-muted-foreground">.v2</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="nav-login-link" className="px-4 py-2 text-sm font-semibold hover:bg-secondary rounded-md transition">Sign in</Link>
          <Link to="/register" data-testid="nav-register-link" className="px-4 py-2 text-sm font-semibold bg-foreground text-background rounded-md hover-lift inline-flex items-center gap-2">
            Get started <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-12 pt-12 lg:pt-20 pb-24 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 fade-up">
            <div className="overline text-muted-foreground mb-6">Premium Fintech &middot; 2026 Edition</div>
            <h1 className="font-display font-bold text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tight">
              The wallet built<br/>
              <span className="text-muted-foreground">for serious money.</span>
            </h1>
            <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
              A modern digital wallet for instant credits and seamless withdrawals.
              Built for users who expect speed, security, and absolute clarity over their funds.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/register" data-testid="hero-cta-register" className="px-6 py-3 rounded-md bg-foreground text-background text-sm font-semibold hover-lift inline-flex items-center gap-2">
                Open your wallet <ArrowRight size={16} weight="bold"/>
              </Link>
              <Link to="/login" data-testid="hero-cta-login" className="px-6 py-3 rounded-md border border-border text-sm font-semibold hover:bg-secondary transition">
                Sign in
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md">
              {[
                { k: "99.99%", v: "Uptime SLA" },
                { k: "<200ms", v: "API Latency" },
                { k: "256-bit", v: "Encryption" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="mono text-2xl font-bold">{s.k}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 fade-up" style={{animationDelay:"120ms"}}>
            <div className="relative card-flat p-6 bg-card overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-foreground/5 blur-3xl" />
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="overline text-muted-foreground">Available Balance</div>
                  <div className="mono text-4xl font-bold mt-2">₹ 84,250<span className="text-xl text-muted-foreground">.00</span></div>
                </div>
                <div className="w-10 h-10 rounded-md bg-foreground text-background flex items-center justify-center">
                  <Wallet size={20} weight="duotone"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-md bg-surface border border-border">
                  <div className="text-xs text-muted-foreground">Credits</div>
                  <div className="mono text-lg font-bold text-success">+ ₹ 1,24,500</div>
                </div>
                <div className="p-3 rounded-md bg-surface border border-border">
                  <div className="text-xs text-muted-foreground">Withdrawals</div>
                  <div className="mono text-lg font-bold text-destructive">- ₹ 40,250</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { t: "API Credit", a: "+ ₹ 5,000", c: "success" },
                  { t: "UPI Withdrawal", a: "- ₹ 2,500", c: "destructive" },
                  { t: "API Credit", a: "+ ₹ 12,000", c: "success" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-b-0">
                    <span className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-muted-foreground"/>
                      {r.t}
                    </span>
                    <span className={`mono font-semibold text-${r.c}`}>{r.a}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 lg:px-12 max-w-7xl mx-auto pb-24">
        <div className="overline text-muted-foreground mb-3">What you get</div>
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight max-w-2xl mb-12">Engineered for clarity. Built for scale.</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { i: Lightning, t: "Instant Credits", d: "External systems credit user wallets via a single signed API endpoint with idempotent transaction IDs." },
            { i: ShieldCheck, t: "Bank-grade Security", d: "Bcrypt password hashing, brute-force protection, device tracking, and force logout on every session." },
            { i: ChartBar, t: "Real-time Insights", d: "Live balance, total credits, total withdrawals, pending counts. Updated the moment they happen." },
            { i: BellRinging, t: "Notifications", d: "In-app bell + Telegram alerts for credits, withdrawals, approvals, and security events." },
            { i: Wallet, t: "UPI &amp; Bank", d: "Add multiple UPI handles and bank accounts. Withdraw to the method you trust." },
            { i: CheckCircle, t: "Audit Ready", d: "Every credit, debit, approval, and admin action is logged immutably." },
          ].map(({ i: Ic, t, d }) => (
            <div key={t} className="card-flat p-6 hover-lift">
              <Ic size={22} weight="duotone" className="mb-4"/>
              <div className="font-display text-lg font-bold mb-2">{t}</div>
              <div className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{__html:d}}/>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border px-6 lg:px-12 py-6 flex justify-between text-sm text-muted-foreground">
        <div>© 2026 DigiWallet V2</div>
        <div className="mono">v2.0.0</div>
      </footer>
    </div>
  );
}
