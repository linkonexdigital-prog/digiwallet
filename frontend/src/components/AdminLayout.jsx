import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import {
  Wallet, ChartLine, UsersThree, Bank, Coin, Key, Bell, ShieldCheck,
  Gear, SignOut, Sun, Moon, List, X, User as UserIcon, Megaphone
} from "@phosphor-icons/react";

const navGroups = [
  { label: "Overview", items: [
    { to: "/admin", label: "Dashboard", icon: ChartLine, end: true },
  ]},
  { label: "Operations", items: [
    { to: "/admin/users", label: "Users", icon: UsersThree },
    { to: "/admin/wallet", label: "Wallet Ops", icon: Coin },
    { to: "/admin/withdrawals", label: "Withdrawals", icon: Bank },
  ]},
  { label: "Integrations", items: [
    { to: "/admin/api", label: "API Keys", icon: Key },
    { to: "/admin/notifications", label: "Notification Center", icon: Megaphone },
  ]},
  { label: "System", items: [
    { to: "/admin/security", label: "Security", icon: ShieldCheck },
    { to: "/admin/settings", label: "Settings", icon: Gear },
  ]},
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [openMobile, setOpenMobile] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <Link to="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand text-brand-foreground flex items-center justify-center"><Wallet size={18} weight="duotone"/></div>
          <span className="font-display font-bold">Admin</span>
        </Link>
        <div className="flex gap-2">
          <button onClick={toggle} className="p-2 rounded-md hover:bg-secondary">{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button onClick={() => setOpenMobile(true)} className="p-2 rounded-md hover:bg-secondary"><List size={20}/></button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 border-r border-border flex-col bg-card">
          <div className="px-5 py-5 border-b border-border">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-md bg-brand text-brand-foreground flex items-center justify-center"><Wallet size={20} weight="duotone"/></div>
              <div>
                <div className="font-display font-bold text-base leading-none">DigiWallet</div>
                <div className="overline text-muted-foreground mt-1">Super Admin</div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {navGroups.map((g) => (
              <div key={g.label}>
                <div className="overline text-muted-foreground px-3 py-2">{g.label}</div>
                <div className="space-y-1">
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} end={it.end}
                      data-testid={`admin-nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                          isActive ? "bg-brand text-brand-foreground shadow-lg shadow-brand/20" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`
                      }>
                      <it.icon size={18} weight="duotone"/> {it.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-border space-y-2">
            <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
              {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>} {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded-full bg-brand text-brand-foreground flex items-center justify-center"><UserIcon size={16}/></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{user?.full_name}</div>
                <div className="overline text-muted-foreground">Admin</div>
              </div>
              <button data-testid="admin-logout-btn" onClick={logout} className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive">
                <SignOut size={16}/>
              </button>
            </div>
          </div>
        </aside>

        {openMobile && (
          <div className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setOpenMobile(false)}>
            <div className="absolute top-0 left-0 w-72 h-full bg-card border-r border-border p-4 fade-up overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <span className="font-display font-bold">Admin</span>
                <button onClick={() => setOpenMobile(false)} className="p-2 rounded-md hover:bg-secondary"><X size={18}/></button>
              </div>
              {navGroups.map((g) => (
                <div key={g.label} className="mb-3">
                  <div className="overline text-muted-foreground px-2 py-1">{g.label}</div>
                  {g.items.map((it) => (
                    <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpenMobile(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                          isActive ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-secondary"
                        }`
                      }>
                      <it.icon size={18} weight="duotone"/> {it.label}
                    </NavLink>
                  ))}
                </div>
              ))}
              <button onClick={logout} className="mt-3 w-full px-3 py-2 text-destructive flex items-center gap-2"><SignOut size={18}/> Sign out</button>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
