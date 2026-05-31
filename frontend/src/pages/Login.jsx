import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Wallet, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";

export default function Login() {
  const { user, login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  if (user && user.id) return <Navigate to={user.role === "admin" ? "/admin" : "/app"} />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const u = await login(mobile.trim(), password);
      nav(u.role === "admin" ? "/admin" : "/app");
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-brand text-brand-foreground p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-20 grid-bg" />
        <Link to="/" className="flex items-center gap-2 z-10">
          <div className="w-9 h-9 rounded-md bg-background text-foreground flex items-center justify-center">
            <Wallet size={20} weight="duotone"/>
          </div>
          <span className="font-display font-bold text-lg">DigiWallet.v2</span>
        </Link>
        <div className="z-10">
          <div className="overline opacity-70 mb-4">Welcome back</div>
          <h1 className="font-display text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
            Your money,<br/>
            <span className="opacity-60">your control.</span>
          </h1>
          <p className="mt-6 text-base opacity-70 max-w-md">
            Sign in to manage credits, withdrawals, payment methods, and notifications — all in one place.
          </p>
        </div>
        <div className="z-10 mono text-xs opacity-50">Built secure · 256-bit encryption · Bcrypt</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-brand text-brand-foreground flex items-center justify-center">
                <Wallet size={20} weight="duotone"/>
              </div>
              <span className="font-display font-bold text-lg">DigiWallet.v2</span>
            </Link>
          </div>

          <div className="overline text-muted-foreground mb-3">Sign in</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-2">Welcome back.</h2>
          <p className="text-sm text-muted-foreground mb-8">Enter your mobile number and password.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="overline text-muted-foreground block mb-2">Mobile number</label>
              <input
                data-testid="login-mobile-input"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="9999999999"
                className="w-full px-4 py-3 mono bg-surface border border-border rounded-md focus:outline-none focus:border-foreground transition"
                required
              />
            </div>
            <div>
              <label className="overline text-muted-foreground block mb-2">Password</label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={show ? "text" : "password"}
                  placeholder="Your password"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-md focus:outline-none focus:border-foreground transition pr-12"
                  required
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeSlash size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>

            {err && <div data-testid="login-error" className="text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

            <button
              data-testid="login-submit-button"
              disabled={busy}
              type="submit"
              className="w-full px-6 py-3 bg-brand text-brand-foreground rounded-md font-semibold hover-lift disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? "Signing in…" : <>Sign in <ArrowRight size={16} weight="bold"/></>}
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-8">
            New here? <Link to="/register" data-testid="login-to-register-link" className="text-foreground font-semibold underline underline-offset-4">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
