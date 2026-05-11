"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Notification = {
    id: string;
    user_id: string;
    actor_id: string;
    post_id: string | null;
    assigned_study_template_id: string | null;
    type: "like" | "comment" | "study_template";
    message: string;
    read: boolean;
    created_at: string;
};

export default function NotificationBell() {
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [userId, setUserId] = useState("");

    useEffect(() => {
        setMounted(true);
        loadNotifications();

        const channel = supabase
            .channel("notifications-channel")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notifications",
                },
                loadNotifications
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function loadNotifications() {
        const { data: sessionData } = await supabase.auth.getSession();

        const user = sessionData.session?.user;

        if (!user) return;

        setUserId(user.id);

        const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30);

        setNotifications(data || []);
    }

    async function openNotification(notification: Notification) {
        await supabase
            .from("notifications")
            .update({ read: true })
            .eq("id", notification.id)
            .eq("user_id", userId);

        setOpen(false);

        if (notification.type === "study_template") {
            router.push("/kalender?open=assigned-pass");
            return;
        }

        router.push(`/pepp?post=${notification.post_id}`);
    }

    async function markAllAsRead() {
        if (!userId) return;

        await supabase
            .from("notifications")
            .update({ read: true })
            .eq("user_id", userId)
            .eq("read", false);

        loadNotifications();
    }

    const unreadCount = notifications.filter((notification) => !notification.read).length;

    const panel =
        open && mounted
            ? createPortal(
                <div
                    onClick={() => setOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 999999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                        background: "rgba(2, 6, 23, 0.82)",
                        backdropFilter: "blur(8px)",
                    }}
                >
                    <section
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: "min(680px, 100%)",
                            maxHeight: "82vh",
                            overflowY: "auto",
                            padding: "24px",
                            borderRadius: "28px",
                            background: "#0f172a",
                            border: "1px solid rgba(148, 163, 184, 0.35)",
                            boxShadow: "0 35px 100px rgba(0,0,0,0.85)",
                            color: "#e2e8f0",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: "16px",
                                marginBottom: "18px",
                            }}
                        >
                            <div>
                                <h2 style={{ margin: 0, fontSize: "26px" }}>🔔 Notiser</h2>
                                <p style={{ margin: "8px 0 0", color: "#93c5fd" }}>
                                    {unreadCount} olästa
                                </p>
                            </div>

                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        style={{
                                            padding: "11px 14px",
                                            borderRadius: "14px",
                                            border: "1px solid rgba(59, 130, 246, 0.6)",
                                            background: "rgba(37, 99, 235, 0.14)",
                                            color: "#93c5fd",
                                            cursor: "pointer",
                                            fontWeight: 800,
                                        }}
                                    >
                                        Markera alla lästa
                                    </button>
                                )}

                                <button
                                    onClick={() => setOpen(false)}
                                    style={{
                                        width: "42px",
                                        height: "42px",
                                        borderRadius: "999px",
                                        border: "1px solid rgba(148, 163, 184, 0.25)",
                                        background: "rgba(30, 41, 59, 0.72)",
                                        color: "#e2e8f0",
                                        cursor: "pointer",
                                        fontSize: "22px",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {notifications.length === 0 ? (
                            <p
                                style={{
                                    margin: 0,
                                    padding: "24px",
                                    borderRadius: "18px",
                                    background: "#1e293b",
                                    color: "#94a3b8",
                                    textAlign: "center",
                                }}
                            >
                                Inga notiser ännu.
                            </p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                {notifications.map((notification) => (
                                    <button
                                        key={notification.id}
                                        onClick={() => openNotification(notification)}
                                        style={{
                                            width: "100%",
                                            padding: "18px",
                                            borderRadius: "20px",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            display: "grid",
                                            gridTemplateColumns: "56px 1fr 12px",
                                            gap: "16px",
                                            alignItems: "center",
                                            background: notification.read ? "#1e293b" : "#172554",
                                            border: notification.read
                                                ? "1px solid rgba(148, 163, 184, 0.22)"
                                                : "1px solid rgba(96, 165, 250, 0.85)",
                                            color: notification.read ? "#cbd5e1" : "#f8fafc",
                                            opacity: notification.read ? 0.55 : 1,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "56px",
                                                height: "56px",
                                                borderRadius: "999px",
                                                background: "#0f172a",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: "24px",
                                            }}
                                        >
                                            {notification.type === "like"
                                                ? "❤️"
                                                : notification.type === "comment"
                                                    ? "💬"
                                                    : "📚"}
                                        </div>

                                        <div style={{ minWidth: 0 }}>
                                            <strong style={{ display: "block", lineHeight: 1.35 }}>
                                                {notification.message}
                                            </strong>

                                            <span
                                                style={{
                                                    display: "block",
                                                    marginTop: "8px",
                                                    color: "#94a3b8",
                                                    fontSize: "14px",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {new Date(notification.created_at).toLocaleString("sv-SE", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>

                                        {!notification.read && (
                                            <div
                                                style={{
                                                    width: "10px",
                                                    height: "10px",
                                                    borderRadius: "999px",
                                                    background: "#3b82f6",
                                                }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>,
                document.body
            )
            : null;

    return (
        <>
            <div className="notification-bell">
                <button
                    onClick={() => setOpen((current) => !current)}
                    className="notification-bell-button"
                    title="Notiser"
                >
                    🔔

                    {unreadCount > 0 && (
                        <span className="notification-badge">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {panel}
        </>
    );
}