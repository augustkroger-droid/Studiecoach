"use client";

import { THEMES, ThemeKey, saveTheme } from "@/lib/themes";

type ThemePickerProps = {
    themeKey: ThemeKey;
    setThemeKey: (themeKey: ThemeKey) => void;
    hidden?: boolean;
};

export default function ThemePicker({
    themeKey,
    setThemeKey,
    hidden = false,
}: ThemePickerProps) {
    if (hidden) return null;

    const theme = THEMES[themeKey];

    return (
        <div
            className="theme-picker"
            style={{
                position: "fixed",
                top: "20px",
                right: "24px",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: "14px",
                padding: "10px 12px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.22)",
                backdropFilter: "blur(10px)",
            }}
        >
            <span style={{ color: theme.muted, fontWeight: 700 }}>Tema</span>

            <select
                value={themeKey}
                onChange={(event) => {
                    const nextTheme = event.target.value as ThemeKey;
                    setThemeKey(nextTheme);
                    saveTheme(nextTheme);
                }}
                style={{
                    border: `1px solid ${theme.border}`,
                    background: theme.input,
                    color: theme.text,
                    borderRadius: "10px",
                    padding: "8px 10px",
                    outline: "none",
                    cursor: "pointer",
                }}
            >
                {Object.entries(THEMES).map(([key, theme]) => (
                    <option key={key} value={key}>
                        {theme.name}
                    </option>
                ))}
            </select>
        </div>
    );
}