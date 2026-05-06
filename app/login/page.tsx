"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
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
      router.push("/kalender");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        background:
          "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
        color: "#e2e8f0",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(148, 163, 184, 0.25)",
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
              color: "#ffffff",
            }}
          >
            Välkommen tillbaka
          </h1>

          <p
            style={{
              marginTop: "10px",
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            Logga in för att fortsätta planera dina studiepass.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={{ fontWeight: "bold", color: "#cbd5e1" }}>
            Användarnamn
          </label>
          <input
            placeholder="Användarnamn"
            value={username}
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
            style={primaryButtonStyle}
          >
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

const primaryButtonStyle = {
  marginTop: "12px",
  padding: "14px",
  borderRadius: "14px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "16px",
  background: "#2563eb",
  color: "#ffffff",
};

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