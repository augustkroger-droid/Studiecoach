"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

export default function LoginPage() {
  const router = useRouter();

  const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

  useEffect(() => {
    setThemeKey(getSavedTheme());
  }, []);

  const theme = THEMES[themeKey];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (!username.trim()) {
      alert("Du måste välja ett användarnamn.");
      return;
    }

    if (username.trim().length < 3) {
      alert("Användarnamnet måste vara minst 3 tecken.");
      return;
    }

    if (!email || !password) {
      alert("Fyll i e-post och lösenord.");
      return;
    }

    const allowedDomains = [
      "hoglandet.se",
      "utb.hoglandet.se",
    ];

    const emailDomain = email.trim().split("@")[1]?.toLowerCase();

    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      alert("E-postadressen du angav är inte giltig på denna sida.");
      return;
    }

    setLoading(true);

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim(),
        },
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    alert("Konto skapat!");
  }

  async function signIn() {
    if (!email || !password) {
      alert("Fyll i både e-post och lösenord.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.push("/");
    }
  }

  return (
    <main
      className="login-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        background: theme.background,
        color: theme.text,
      }}
    >
      <section
        className="login-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "44px", marginBottom: "8px" }}>🎓</div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              color: theme.text,
            }}
          >
            Välkommen tillbaka
          </h1>

          <p
            style={{
              marginTop: "10px",
              color: theme.muted,
              lineHeight: 1.5,
            }}
          >
            Logga in för att fortsätta planera dina studiepass.
          </p>
        </div>

        <div className="login-form" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={{ fontWeight: "bold", color: "#cbd5e1" }}>
            Användarnamn
          </label>
          <input
            placeholder="Användarnamn"
            value={username}
            maxLength={20}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />
          <label style={{ fontWeight: "bold", color: "#cbd5e1" }}>
            E-post
          </label>

          <input
            placeholder="namn@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <label style={{ fontWeight: "bold", color: "#cbd5e1" }}>
            Lösenord
          </label>

          <input
            placeholder="Ditt lösenord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") signIn();
            }}
            style={inputStyle}
          />

          <button
            onClick={signIn}
            disabled={loading}
            style={primaryButtonStyle(theme)}          >
            {loading ? "Loggar in..." : "Logga in"}
          </button>

          <button
            onClick={signUp}
            disabled={loading}
            style={secondaryButtonStyle}
          >
            Skapa konto
          </button>
        </div>
      </section>

      <div className="login-theme-picker">
        <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(2, 6, 23, 0.7)",
  color: "#ffffff",
  fontSize: "16px",
  outline: "none",
  boxSizing: "border-box" as const,
};

const primaryButtonStyle = (theme: typeof THEMES[ThemeKey]) => ({
  marginTop: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: `1px solid ${theme.border}`,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "16px",
  background: "rgba(255,255,255,0.14)",
  color: theme.text,
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
});

const secondaryButtonStyle = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "16px",
  background: "transparent",
  color: "#cbd5e1",
};