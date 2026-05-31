import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

const ThemeCtx = createContext(null);
const VALID_COLOR_THEMES = ["monochrome", "emerald", "cobalt"];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem("dw_theme") || "dark");
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem("dw_color_theme") || "monochrome");

  // Apply light/dark
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("dw_theme", theme);
  }, [theme]);

  // Apply color theme class
  useEffect(() => {
    const root = document.documentElement;
    VALID_COLOR_THEMES.forEach((t) => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${colorTheme}`);
    localStorage.setItem("dw_color_theme", colorTheme);
  }, [colorTheme]);

  // Sync from server (admin-controlled). Refetch every 60s.
  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      try {
        const r = await api.get("/public/settings");
        const srv = r.data.color_theme;
        if (srv && VALID_COLOR_THEMES.includes(srv) && srv !== colorTheme) {
          setColorTheme(srv);
        }
      } catch (e) { if (process.env.NODE_ENV !== "production") console.debug("[dw]", e); }
    };
    fetch();
    const i = setInterval(() => alive && fetch(), 60000);
    return () => { alive = false; clearInterval(i); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      theme, setTheme,
      colorTheme, setColorTheme,
      toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
      validColorThemes: VALID_COLOR_THEMES,
    }),
    [theme, colorTheme]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};
export const useTheme = () => useContext(ThemeCtx);
