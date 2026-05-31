import React, { createContext, useContext, useEffect, useState } from "react";
import api, { fmtErr } from "@/lib/api";

const AuthCtx = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null=loading, false=guest, obj=auth
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("dw_token");
    if (!token) { setUser(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => { localStorage.removeItem("dw_token"); setUser(false); });
  }, []);

  const login = async (mobile_number, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { mobile_number, password });
      localStorage.setItem("dw_token", data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = fmtErr(e); setError(msg); throw new Error(msg);
    }
  };

  const register = async (payload) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("dw_token", data.token);
      setUser(data.user);
      return data.user;
    } catch (e) {
      const msg = fmtErr(e); setError(msg); throw new Error(msg);
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
    localStorage.removeItem("dw_token");
    setUser(false);
    window.location.href = "/login";
  };

  const refresh = async () => {
    try { const r = await api.get("/auth/me"); setUser(r.data); } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
  };

  const loginAs = (token, u) => {
    localStorage.setItem("dw_admin_backup", localStorage.getItem("dw_token") || "");
    localStorage.setItem("dw_token", token);
    setUser(u);
  };

  const restoreAdmin = () => {
    const backup = localStorage.getItem("dw_admin_backup");
    if (!backup) return;
    localStorage.setItem("dw_token", backup);
    localStorage.removeItem("dw_admin_backup");
    window.location.href = "/admin";
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, error, login, register, logout, refresh, loginAs, restoreAdmin }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
