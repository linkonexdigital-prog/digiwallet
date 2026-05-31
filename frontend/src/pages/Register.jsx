import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Wallet, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";

export default function Register() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({ full_name: "", mobile_number: "", password: "", confirm_password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  if (user && user.id) return <Navigate to={user.role === "admin" ? "/admin" : "/app"} />;

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { setErr("Passwords do not match"); return; }
    setBusy(true); setErr("");
    try {
      await register(form);
      nav("/app");
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background order-2 lg:order-1">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-brand text-brand-foreground flex items-center justify-center">
                <Wallet size={20} weight="duotone"/>
              </div>
              <span className="font-display font-bold text-lg">DigiWallet.v2</span>
            </Link>
          </div>

          <div className="overline text-muted-foreground mb-3">Create wallet</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-2">Open your wallet.</h2>
          <p className="text-sm text-muted-foreground mb-8">It takes less than a minute.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="overline text-muted-foreground block mb-2">Full name</label>
              <input
                data-testid="register-name-input"
                value={form.full_name} onChange={(e) => set("full_name", e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-surface border border-border rounded-md focus:outline-none focus:border-foreground transition"
                required minLength={2}
              />
            </div>
            <div>
              <label className="overline text-muted-foreground block mb-2">Mobile number</label>
              <input
                data-testid="register-mobile-input"
                value={form.mobile_number} onChange={(e) => set("mobile_number", e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric" placeholder="9876543210"
                className="w-full px-4 py-3 mono bg-surface border border-border rounded-md focus:outline-none focus:border-foreground transition"
                required minLength={10} maxLength={15}
              />
            </div>
            <div>
              <label className="overline text-muted-foreground block mb-2">Password</label>
              <div className="relative">
                <input
                  data-testid="register-password-input"
                  value={form.password} onChange={(e) => set("password", e.target.value)}
                  type={show ? "text" : "password"} placeholder="At least 6 characters"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-md focus:outline-none focus:border-foreground transition pr-12"
                  required minLength={6}
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeSlash size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="overline text-muted-foreground block mb-2">Confirm password</label>
              <input
                data-testid="register-confirm-input"
                value={form.confirm_password} onChange={(e) => set("confirm_password", e.target.value)}
                type={show ? "text" : "password"} placeholder="Repeat password"
                className="w-full px-4 py-3 bg-surface border border-border rounded-md focus:outline-none focus:border-foreground transition"
                required minLength={6}
              />
            </div>

            {err && <div data-testid="register-error" className="text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 rounded-md">{err}</div>}

            <button
              data-testid="register-submit-button"
              disabled={busy}
              type="submit"
              className="w-full px-6 py-3 bg-brand text-brand-foreground rounded-md font-semibold hover-lift disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? "Creating…" : <>Create account <ArrowRight size={16} weight="bold"/></>}
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-8">
            Already have an account? <Link to="/login" data-testid="register-to-login-link" className="text-foreground font-semibold underline underline-offset-4">Sign in</Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex relative bg-brand text-brand-foreground p-12 flex-col justify-between overflow-hidden order-1 lg:order-2">
        <div className="absolute inset-0 opacity-20 grid-bg" />
        <Link to="/" className="flex items-center gap-2 z-10 self-end">
          <div className="w-9 h-9 rounded-md bg-background text-foreground flex items-center justify-center">
            <Wallet size={20} weight="duotone"/>
          </div>
          <span className="font-display font-bold text-lg">DigiWallet.v2</span>
        </Link>
        <div className="z-10">
          <div className="overline opacity-70 mb-4">Get started</div>
          <h1 className="font-display text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05]">
            One wallet.<br/>
            <span className="opacity-60">Every transaction.</span>
          </h1>
        </div>
        <div className="z-10 mono text-xs opacity-50">No OTP · No KYC step · Just clean wallet access</div>
      </div>
    </div>
  );
}
