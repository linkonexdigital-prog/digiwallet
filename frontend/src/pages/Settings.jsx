import React, { useEffect, useState } from "react";
import api, { fmtErr } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Lock, User as UserIcon, TelegramLogo, PaperPlaneTilt, FloppyDisk, BellRinging, CheckCircle, BellSlash } from "@phosphor-icons/react";
import { subscribeForPush, unsubscribeFromPush, getPushStatus, sendTestPush } from "@/lib/webPush";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [tgChat, setTgChat] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState({ supported: false, permission: "default", subscribed: false });

  const refreshPush = async () => setPushStatus(await getPushStatus());

  useEffect(() => {
    api.get("/auth/me").then((r) => setTgChat(r.data.telegram_chat_id || "")).catch(() => {});
    refreshPush();
  }, []);

  const submitPw = async (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    if (pw.new_password !== pw.confirm) { setErr("New passwords do not match"); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      setMsg("Password updated successfully.");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (e) { setErr(fmtErr(e)); }
    finally { setBusy(false); }
  };

  const saveTg = async () => {
    setMsg(""); setErr(""); setTgBusy(true);
    try {
      await api.post("/auth/telegram", { telegram_chat_id: tgChat.trim() });
      setMsg("Telegram chat ID saved.");
      refresh && refresh();
    } catch (e) { setErr(fmtErr(e)); } finally { setTgBusy(false); }
  };

  const testTg = async () => {
    setMsg(""); setErr(""); setTgBusy(true);
    try {
      await api.post("/auth/telegram/test");
      setMsg("Test alert sent. Check your Telegram chat.");
    } catch (e) { setErr(fmtErr(e)); } finally { setTgBusy(false); }
  };

  const enablePush = async () => {
    setMsg(""); setErr(""); setPushBusy(true);
    try {
      const r = await subscribeForPush();
      if (r.ok) setMsg("Browser push enabled. You'll get alerts even when this tab is closed.");
      else if (r.reason === "unsupported") setErr("Your browser doesn't support push notifications.");
      else if (r.reason === "denied") setErr("Permission denied. Enable from browser site settings.");
      else setErr(`Could not subscribe: ${r.error || r.reason}`);
    } catch (e) { setErr(fmtErr(e)); }
    finally { refreshPush(); setPushBusy(false); }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try { await unsubscribeFromPush(); setMsg("Browser push disabled."); }
    finally { refreshPush(); setPushBusy(false); }
  };

  const doTestPush = async () => {
    setMsg(""); setErr(""); setPushBusy(true);
    try { await sendTestPush(); setMsg("Test push sent. Check your system notifications."); }
    catch (e) { setErr(fmtErr(e)); } finally { setPushBusy(false); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto fade-up">
      <div className="mb-8">
        <div className="overline text-muted-foreground mb-2">Profile</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="card-flat p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand/[0.06] blur-3xl"/>
        <div className="flex items-center gap-4 relative">
          <div className="w-14 h-14 rounded-md bg-gradient-to-br from-brand to-brand/70 text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/20"><UserIcon size={26} weight="duotone"/></div>
          <div>
            <div className="font-display text-xl font-bold">{user?.full_name}</div>
            <div className="mono text-sm text-muted-foreground">{user?.mobile_number}</div>
            <div className="flex gap-2 mt-1">
              <span className="overline text-muted-foreground">User</span>
              <span className={`pill pill-${user?.status}`}>{user?.status}</span>
            </div>
          </div>
        </div>
      </div>

      {msg && <div className="mb-4 text-sm bg-success/10 text-success border border-success/30 px-3 py-2 rounded-md fade-up">{msg}</div>}
      {err && <div className="mb-4 text-sm bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2 rounded-md fade-up">{err}</div>}

      {/* Browser Push */}
      <div className="card-flat p-6 mb-6 bg-gradient-to-br from-card to-brand/[0.05]">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-brand/15 text-brand flex items-center justify-center"><BellRinging size={22} weight="duotone"/></div>
            <div>
              <h3 className="font-display text-lg font-bold">Browser push alerts</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">Real-time notifications on your phone or computer — even when DigiWallet is closed in another tab or completely shut down.</p>
            </div>
          </div>
          {pushStatus.subscribed ? (
            <span className="pill pill-success inline-flex items-center gap-1"><CheckCircle size={12}/> Active</span>
          ) : pushStatus.permission === "denied" ? (
            <span className="pill pill-rejected inline-flex items-center gap-1"><BellSlash size={12}/> Blocked</span>
          ) : (
            <span className="pill pill-info">Not enabled</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!pushStatus.subscribed ? (
            <button data-testid="settings-enable-push" onClick={enablePush} disabled={pushBusy || !pushStatus.supported} className="px-4 py-2.5 rounded-md bg-brand text-brand-foreground text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
              <BellRinging size={14}/> {pushBusy ? "Enabling…" : "Enable push notifications"}
            </button>
          ) : (
            <>
              <button data-testid="settings-test-push" onClick={doTestPush} disabled={pushBusy} className="px-4 py-2.5 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center gap-2">
                <PaperPlaneTilt size={14}/> Send test push
              </button>
              <button data-testid="settings-disable-push" onClick={disablePush} disabled={pushBusy} className="px-4 py-2.5 rounded-md bg-secondary text-sm font-semibold inline-flex items-center gap-2">
                <BellSlash size={14}/> Disable
              </button>
            </>
          )}
        </div>
      </div>

      {/* Telegram */}
      <div className="card-flat p-6 mb-6 bg-gradient-to-br from-card via-card to-[#229ED9]/[0.04]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-md bg-[#229ED9]/15 text-[#229ED9] flex items-center justify-center"><TelegramLogo size={22} weight="duotone"/></div>
          <div>
            <h3 className="font-display text-lg font-bold">Telegram bot alerts</h3>
            <p className="text-xs text-muted-foreground mt-1">Receive every transaction directly on your Telegram. Get your <strong>chat ID</strong> from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="underline">@userinfobot</a>.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            data-testid="settings-tg-chat-input"
            value={tgChat}
            onChange={(e) => setTgChat(e.target.value)}
            placeholder="Your Telegram chat ID (e.g. 123456789)"
            className="flex-1 min-w-[200px] px-4 py-3 mono bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-foreground"
          />
          <button data-testid="settings-tg-save" onClick={saveTg} disabled={tgBusy} className="px-4 py-3 rounded-md bg-brand text-brand-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            <FloppyDisk size={14}/> Save
          </button>
          <button data-testid="settings-tg-test" onClick={testTg} disabled={tgBusy || !tgChat.trim()} className="px-4 py-3 rounded-md bg-[#229ED9] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
            <PaperPlaneTilt size={14}/> Send test
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="card-flat p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={18}/>
          <h3 className="font-display text-lg font-bold">Change password</h3>
        </div>
        <form onSubmit={submitPw} className="space-y-3">
          <input data-testid="settings-current-pw" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
            placeholder="Current password" className="w-full px-4 py-3 bg-surface border border-border rounded-md text-sm" required minLength={6}/>
          <input data-testid="settings-new-pw" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
            placeholder="New password" className="w-full px-4 py-3 bg-surface border border-border rounded-md text-sm" required minLength={6}/>
          <input data-testid="settings-confirm-pw" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            placeholder="Confirm new password" className="w-full px-4 py-3 bg-surface border border-border rounded-md text-sm" required minLength={6}/>
          <button data-testid="settings-save-btn" disabled={busy} type="submit" className="px-5 py-3 rounded-md bg-brand text-brand-foreground text-sm font-semibold">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
