"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setEmail(data.user.email || "");
      }
    }
    loadUser();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        background:
          "linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%)",
        color: "#e2e8f0",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>📚 Studiecoach</h1>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            Inloggad som: {email}
          </p>
        </div>

        <button
          onClick={logout}
          style={{
            background: "#ef4444",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logga ut
        </button>
      </div>

      {/* Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        <Link href="/kalender" style={{ textDecoration: "none" }}>
          <div style={cardStyle()}>
            <h2>📅 Kalender</h2>
            <p>Planera och genomför dina studiepass</p>
          </div>
        </Link>

        <Link href="/pepp" style={{ textDecoration: "none" }}>
          <div style={cardStyle()}>
            <h2>🔥 Pepp</h2>
            <p>Se när andra pluggar</p>
          </div>
        </Link>

        <Link href="/tips" style={{ textDecoration: "none" }}>
          <div style={cardStyle()}>
            <h2>💡 Tips</h2>
            <p>Lär dig bättre studieteknik</p>
          </div>
        </Link>
      </section>
    </main>
  );
}

function cardStyle() {
  return {
    background: "rgba(15, 23, 42, 0.7)",
    padding: "20px",
    borderRadius: "16px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
    color: "#e2e8f0",
    transition: "0.2s",
    cursor: "pointer",
  };
}