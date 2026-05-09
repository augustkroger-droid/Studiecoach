"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function NavBar() {
  const pathname = usePathname();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event);
      console.log("Session:", session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <nav
      className="main-navbar"
      style={{
        display: "flex",
        gap: "16px",
        marginBottom: "30px",
        padding: "10px 16px",
        background: "rgba(15, 23, 42, 0.6)",
        borderRadius: "12px",
        width: "fit-content",
        backdropFilter: "blur(6px)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
      }}
    >
      <NavItem href="/" label="🏠 Hem" active={pathname === "/"} />

      <NavItem
        href="/kalender"
        label="📅 Kalender"
        active={pathname === "/kalender"}
      />

      <NavItem
        href="/pepp"
        label="🔥 Pepp"
        active={pathname === "/pepp"}
      />

      <NavItem
        href="/tips"
        label="💡 Tips"
        active={pathname === "/tips"}
      />

      <NavItem
        href="/profil"
        label="👤 Profil"
        active={pathname === "/profil"}
      />
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="main-navbar-link"
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        textDecoration: "none",
        fontWeight: "bold",
        color: active ? "white" : "#cbd5f5",
        background: active ? "#2563eb" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}