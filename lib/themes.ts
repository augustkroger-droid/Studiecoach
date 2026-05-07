export const THEMES = {
    ocean: {
        name: "Ocean",
        background:
            "radial-gradient(circle at 15% 20%, rgba(59,130,246,0.45) 0%, transparent 28%), radial-gradient(circle at 85% 15%, rgba(14,165,233,0.28) 0%, transparent 30%), radial-gradient(circle at 50% 90%, rgba(30,64,175,0.45) 0%, transparent 34%), linear-gradient(135deg, #071827 0%, #0f2f4a 42%, #164e63 72%, #1d4ed8 100%)",
        card: "rgba(15, 23, 42, 0.58)",
        cardSoft: "rgba(30, 64, 85, 0.36)",
        border: "rgba(226, 232, 240, 0.22)",
        text: "#f8fafc",
        muted: "#cbd5e1",
        input: "rgba(15, 23, 42, 0.44)",
    },
    lavender: {
        name: "Lavendel",
        background:
            "radial-gradient(circle at 12% 18%, rgba(216,180,254,0.35) 0%, transparent 27%), radial-gradient(circle at 82% 18%, rgba(124,58,237,0.45) 0%, transparent 30%), radial-gradient(circle at 55% 88%, rgba(236,72,153,0.22) 0%, transparent 32%), linear-gradient(135deg, #2e1065 0%, #5b21b6 45%, #7c3aed 75%, #c4b5fd 100%)",
        card: "rgba(30, 27, 75, 0.52)",
        cardSoft: "rgba(76, 29, 149, 0.32)",
        border: "rgba(237, 233, 254, 0.24)",
        text: "#faf5ff",
        muted: "#ddd6fe",
        input: "rgba(30, 27, 75, 0.38)",
    },
    forest: {
        name: "Skog",
        background:
            "radial-gradient(circle at 18% 22%, rgba(132,204,22,0.34) 0%, transparent 28%), radial-gradient(circle at 88% 14%, rgba(34,197,94,0.28) 0%, transparent 30%), radial-gradient(circle at 50% 90%, rgba(20,83,45,0.55) 0%, transparent 34%), linear-gradient(135deg, #052e16 0%, #166534 42%, #15803d 72%, #84cc16 100%)",
        card: "rgba(20, 83, 45, 0.48)",
        cardSoft: "rgba(22, 101, 52, 0.30)",
        border: "rgba(220, 252, 231, 0.24)",
        text: "#f0fdf4",
        muted: "#bbf7d0",
        input: "rgba(20, 83, 45, 0.34)",
    },
    sunset: {
        name: "Solnedgång",
        background:
            "radial-gradient(circle at 16% 20%, rgba(251,191,36,0.46) 0%, transparent 28%), radial-gradient(circle at 84% 18%, rgba(253,224,71,0.38) 0%, transparent 30%), radial-gradient(circle at 52% 88%, rgba(234,88,12,0.50) 0%, transparent 34%), linear-gradient(135deg, #713f12 0%, #ca8a04 38%, #f59e0b 68%, #fde047 100%)",
        card: "rgba(67, 20, 7, 0.42)",
        cardSoft: "rgba(154, 52, 18, 0.28)",
        border: "rgba(254, 240, 138, 0.30)",
        text: "#fffbea",
        muted: "#fef3c7",
        input: "rgba(67, 20, 7, 0.32)",
    },
    rainbow: {
        name: "Rainbow",
        background:
            "radial-gradient(circle at 12% 18%, rgba(244,63,94,0.45) 0%, transparent 25%), radial-gradient(circle at 84% 16%, rgba(250,204,21,0.42) 0%, transparent 28%), radial-gradient(circle at 18% 84%, rgba(34,197,94,0.38) 0%, transparent 30%), radial-gradient(circle at 82% 82%, rgba(59,130,246,0.42) 0%, transparent 30%), linear-gradient(135deg, #581c87 0%, #db2777 28%, #f97316 48%, #22c55e 72%, #2563eb 100%)",
        card: "rgba(15, 23, 42, 0.50)",
        cardSoft: "rgba(255, 255, 255, 0.13)",
        border: "rgba(255, 255, 255, 0.28)",
        text: "#ffffff",
        muted: "#f8fafc",
        input: "rgba(15, 23, 42, 0.34)",
    },
} as const;

export type ThemeKey = keyof typeof THEMES;

export function getSavedTheme(): ThemeKey {
    if (typeof window === "undefined") return "ocean";

    const savedTheme = localStorage.getItem("study-theme");

    if (savedTheme && savedTheme in THEMES) {
        return savedTheme as ThemeKey;
    }

    return "ocean";
}

export function saveTheme(themeKey: ThemeKey) {
    localStorage.setItem("study-theme", themeKey);
}