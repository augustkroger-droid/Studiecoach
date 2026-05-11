"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";

export default function NavBar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    const cachedAdmin = localStorage.getItem("navbarIsAdmin") === "true";
    const cachedTeacher = localStorage.getItem("navbarIsTeacher") === "true";
    const cachedLoaded = localStorage.getItem("navbarRoleLoaded") === "true";

    if (cachedLoaded) {
      setIsAdmin(cachedAdmin);
      setIsTeacher(cachedTeacher);
      setRoleLoaded(true);
    }

    checkRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkRole() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setIsAdmin(false);
      setIsTeacher(false);
      setRoleLoaded(true);

      localStorage.removeItem("navbarIsAdmin");
      localStorage.removeItem("navbarIsTeacher");
      localStorage.removeItem("navbarRoleLoaded");

      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    const admin = data?.is_admin === true || data?.role === "admin";
    const teacher = data?.role === "teacher" || admin;

    setIsAdmin(admin);
    setIsTeacher(teacher);
    setRoleLoaded(true);

    localStorage.setItem("navbarIsAdmin", String(admin));
    localStorage.setItem("navbarIsTeacher", String(teacher));
    localStorage.setItem("navbarRoleLoaded", "true");
  }

  if (!roleLoaded) {
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
          flexWrap: "wrap",
          minHeight: "52px",
          minWidth: "460px",
        }}
      />
    );
  }

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
        flexWrap: "wrap",
      }}
    >
      {isTeacher && (
        <NavItem
          href="/elevoversikt"
          label="📊 Elevöversikt"
          active={pathname === "/elevoversikt"}
        />
      )}
      {(!isTeacher || isAdmin) && (
        <NavItem href="/" label="🏠 Hem" active={pathname === "/"} />
      )}
      {(!isTeacher || isAdmin) && (
        <NavItem
          href="/kalender"
          label="📅 Kalender"
          active={pathname === "/kalender"}
        />
      )}
      <NavItem href="/pepp" label="🔥 Pepp" active={pathname === "/pepp"} />
      <NavItem href="/tips" label="💡 Tips" active={pathname === "/tips"} />
      <NavItem href="/profil" label="👤 Profil" active={pathname === "/profil"} />


      {isTeacher && (
        <NavItem
          href="/teacher"
          label="👩‍🏫 Mina elever"
          active={pathname === "/teacher"}
        />
      )}

      {isTeacher && (
        <NavItem
          href="/admin/pass"
          label="📚 Planera pass"
          active={pathname.startsWith("/admin/pass") || pathname.startsWith("/admin/studiepass")}
        />
      )}

      {isAdmin && (
        <NavItem href="/admin" label="🛠 Admin" active={pathname === "/admin"} />
      )}



      <NotificationBell />
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
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}