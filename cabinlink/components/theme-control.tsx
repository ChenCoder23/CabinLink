"use client";
import { useEffect, useState } from "react";
export function ThemeControl() { const [theme, setTheme] = useState("original"); useEffect(() => { const timer = setTimeout(() => setTheme(document.documentElement.dataset.theme || "original"), 0); return () => clearTimeout(timer); }, []); return <label className="theme-control">外观 <select aria-label="外观主题" value={theme} onChange={e => { const value = e.target.value; setTheme(value); document.documentElement.dataset.theme = value; try {
    localStorage.setItem("cabinlink-theme", value);
}
catch { } }}><option value="original">原有外观</option><option value="light">黑白浅色</option><option value="dark">黑白深色</option></select></label>; }
