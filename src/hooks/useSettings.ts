"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/storage";
import { SCHEME_VARS } from "@/lib/colors";
import type { AppSettings } from "@/lib/types";

const FONT_SCALE: Record<AppSettings["fontSize"], string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.classList.toggle("dark", settings.theme === "dark");
    root.classList.toggle("light", settings.theme === "light");
    const vars = SCHEME_VARS[settings.colorScheme];
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--font-scale", FONT_SCALE[settings.fontSize]);
    saveSettings(settings);
  }, [settings, ready]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  return { settings, update, ready };
}
