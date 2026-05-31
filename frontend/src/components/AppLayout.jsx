import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import { useLiveNotifications } from "@/lib/useLiveNotifications";
import { ensureSWRegistered, subscribeForPush, getPushStatus } from "@/lib/webPush";
import {
  Wallet, House, ArrowsLeftRight, Bank, Bell, Gear, SignOut,
  Sun, Moon, List, X, ArrowUUpLeft, User as UserIcon, BellRinging
} from "@phosphor-icons/react";

const navItems = [
  { to: "/app", label: "Overview", icon: House, end: true },
  { to: "/app/transactions", label: "Transactions", icon: ArrowsLeftRight },
  { to: "/app/withdrawals", label: "Withdrawals", icon: Bank },
  { to: "/app/notifications", label: "Notifications", icon: Bell },
  { to: "/app/settings", label: "Settings", icon: Gear },
];

const SidebarNav = ({ unread, onItemClick = () => {}, compact = false }) => (
  <nav className={compact ? "space-y-1" : "flex-1 p-3 space-y-1"}>
    {!compact && <div className="overline text-muted-foreground px-3 py-2">Navigation</div>}
    {navItems.map((it) => (
      <NavLink
        key={it.to} to={it.to} end={it.end} onClick={onItemClick}
        data-testid={`sidebar-${it.label.toLowerCase()}-link`}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
            isActive ? "bg-brand text-brand-foreground shadow-lg shadow-brand/20" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`
        }
      >
        <it.icon size={18} weight="duotone"/>
        <span className="flex-1">{it.label}</span>
        {!compact && it.to === "/app/notifications" && unread > 0 && (
          <span data-testid="sidebar-unread-badge" className="mono text-[10px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">{unread}</span>
        )}
      </NavLink>
    ))}
  </nav>
);

const DesktopSidebar = ({ user, unread, theme, toggle, adminBackup, onRestoreAdmin, onLogout }) => (
  <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 border-r border-border flex-col bg-card">
    <div className="px-5 py-5 border-b border-border">
      <Link to="/app" className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-md bg-brand text-brand-foreground flex items-center justify-center"><Wallet size={20} weight="duotone"/></div>
        <div>
          <div className="font-display font-bold text-base leading-none">DigiWallet</div>
          <div className="overline text-muted-foreground mt-1">v2 · User Portal</div>
        </div>
      </Link>
    </div>

    <SidebarNav unread={unread}/>

    <div className="p-3 border-t border-border space-y-2">
      <button onClick={toggle} data-testid="theme-toggle-desktop" className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition">
        {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>

      {adminBackup && (
        <button onClick={onRestoreAdmin} data-testid="restore-admin-btn" className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-warning/10 text-warning hover:bg-warning/20 transition">
          <ArrowUUpLeft size={18}/>
          <span>Back to admin</span>
        </button>
      )}

      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center"><UserIcon size={16}/></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{user?.full_name}</div>
          <div className="mono text-xs text-muted-foreground truncate">{user?.mobile_number}</div>
        </div>
        <button data-testid="logout-button" onClick={onLogout} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive">
          <SignOut size={16}/>
        </button>
      </div>
    </div>
  </aside>
);

const MobileTopBar = ({ theme, toggle, onOpenMenu }) => (
  <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
    <Link to="/app" className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-md bg-brand text-brand-foreground flex items-center justify-center"><Wallet size={18} weight="duotone"/></div>
      <span className="font-display font-bold">DigiWallet</span>
    </Link>
    <div className="flex items-center gap-2">
      <button data-testid="theme-toggle" onClick={toggle} className="p-2 rounded-md hover:bg-secondary">
        {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
      </button>
      <button data-testid="mobile-menu-toggle" onClick={onOpenMenu} className="p-2 rounded-md hover:bg-secondary">
        <List size={20}/>
      </button>
    </div>
  </header>
);

const MobileDrawer = ({ onClose, onLogout }) => (
  <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={onClose}>
    <div className="absolute top-0 left-0 w-72 h-full bg-card border-r border-border p-4 fade-up" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <Link to="/app" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand text-brand-foreground flex items-center justify-center"><Wallet size={18}/></div>
          <span className="font-display font-bold">DigiWallet</span>
        </Link>
        <button onClick={onClose} className="p-2 rounded-md hover:bg-secondary"><X size={18}/></button>
      </div>
      <SidebarNav compact onItemClick={onClose}/>
      <button onClick={onLogout} className="mt-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-destructive hover:bg-destructive/10">
        <SignOut size={18}/> Sign out
      </button>
    </div>
  </div>
);

const PushPermissionBanner = ({ onEnable, onDismiss }) => (
  <div className="px-4 lg:px-6 pt-4">
    <div className="card-flat px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-brand/10 to-transparent border-brand/30">
      <div className="w-10 h-10 rounded-md bg-brand/15 text-brand flex items-center justify-center shrink-0">
        <BellRinging size={20} weight="duotone"/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Enable real-time push alerts</div>
        <div className="text-xs text-muted-foreground">Get instant Chrome / phone notifications for credits & withdrawals — <strong>even when DigiWallet is closed</strong>.</div>
      </div>
      <button data-testid="enable-push-btn" onClick={onEnable} className="px-3 py-2 rounded-md bg-brand text-brand-foreground text-xs font-bold shrink-0 hover-lift">Enable</button>
      <button onClick={onDismiss} className="p-2 text-muted-foreground hover:text-foreground"><X size={16}/></button>
    </div>
  </div>
);

export default function AppLayout({ children }) {
  const { user, logout, restoreAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  useLocation(); // keep subscription so nested NavLinks re-render on route change
  const { unread, permission } = useLiveNotifications(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem("dw_notif_banner_dismissed") === "1");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const adminBackup = typeof window !== "undefined" && localStorage.getItem("dw_admin_backup");

  useEffect(() => {
    ensureSWRegistered();
    getPushStatus().then((s) => setPushSubscribed(s.subscribed));
  }, []);

  const dismissBanner = () => { localStorage.setItem("dw_notif_banner_dismissed", "1"); setBannerDismissed(true); };
  const enablePush = async () => {
    const r = await subscribeForPush();
    if (r.ok) { setPushSubscribed(true); dismissBanner(); }
    else if (r.reason === "denied") { dismissBanner(); }
  };

  const showBanner = permission === "default" && !pushSubscribed && !bannerDismissed;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileTopBar theme={theme} toggle={toggle} onOpenMenu={() => setMobileOpen(true)}/>

      <div className="flex">
        <DesktopSidebar
          user={user}
          unread={unread}
          theme={theme}
          toggle={toggle}
          adminBackup={adminBackup}
          onRestoreAdmin={restoreAdmin}
          onLogout={logout}
        />

        {mobileOpen && <MobileDrawer onClose={() => setMobileOpen(false)} onLogout={logout}/>}

        <main className="flex-1 min-w-0">
          {showBanner && <PushPermissionBanner onEnable={enablePush} onDismiss={dismissBanner}/>}
          {children}
        </main>
      </div>
    </div>
  );
}
