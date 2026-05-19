"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import ThemePicker from "@/components/ThemePicker";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";

type Profile = {
    id: string;
    username: string | null;
    is_admin?: boolean;
    role?: "student" | "teacher" | "admin" | null;
    show_on_leaderboard?: boolean;
};

type StudySession = {
    id: string;
    user_id: string;
    subject: string;
    duration: number;
    date: string;
    start_time?: string | null;
    status: "planned" | "active" | "paused" | "done" | "missed";
    remaining_seconds?: number | null;
    started_at?: string | null;
};

type StudyPost = {
    id: string;
    user_id: string;
    subject: string;
    duration: number;
    date: string;
    comment: string | null;
    created_at: string;
    post_type?: string | null;
    title?: string | null;
};

type TeacherStudentAccess = {
    student_id: string;
};

function todayString() {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
    ].join("-");
}

function weekStartString() {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);

    return [
        monday.getFullYear(),
        String(monday.getMonth() + 1).padStart(2, "0"),
        String(monday.getDate()).padStart(2, "0"),
    ].join("-");
}

function yesterdayString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return [
        yesterday.getFullYear(),
        String(yesterday.getMonth() + 1).padStart(2, "0"),
        String(yesterday.getDate()).padStart(2, "0"),
    ].join("-");
}

function formatHours(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
    if (hours > 0) return `${hours} h`;
    return `${mins} min`;
}

function formatDate(dateString: string) {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
}

function formatRemainingTime(session: StudySession) {
    return formatClock(getRemainingSeconds(session));
}

function getRemainingSeconds(session: StudySession) {
    const baseSeconds = session.remaining_seconds ?? session.duration * 60;

    if (session.status !== "active" || !session.started_at) {
        return baseSeconds;
    }

    const elapsedSeconds = Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / 1000
    );

    return Math.max(baseSeconds - elapsedSeconds, 0);
}

function formatClock(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export default function ElevoversiktPage() {
    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];

    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [posts, setPosts] = useState<StudyPost[]>([]);

    const [, setClockTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setClockTick((tick) => tick + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadOverview();
    }, []);

    useEffect(() => {
        const expiredActiveSessions = sessions.filter(
            (session) => session.status === "active" && getRemainingSeconds(session) <= 0
        );

        if (expiredActiveSessions.length === 0) return;

        async function pauseExpiredSessions() {
            const ids = expiredActiveSessions.map((session) => session.id);

            const { error } = await supabase
                .from("study_sessions")
                .update({
                    status: "paused",
                    remaining_seconds: 0,
                    started_at: null,
                })
                .in("id", ids);

            if (error) {
                console.error("Kunde inte pausa färdiga aktiva pass:", error.message);
                return;
            }

            setSessions((current) =>
                current.map((session) =>
                    ids.includes(session.id)
                        ? {
                            ...session,
                            status: "paused",
                            remaining_seconds: 0,
                            started_at: null,
                        }
                        : session
                )
            );
        }

        pauseExpiredSessions();
    }, [sessions]);

    async function loadOverview() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { data: myProfile } = await supabase
            .from("profiles")
            .select("id, username, is_admin, role")
            .eq("id", user.id)
            .single();

        const isAdmin = myProfile?.is_admin === true || myProfile?.role === "admin";
        const isTeacher = myProfile?.role === "teacher" || isAdmin;

        if (!isTeacher) {
            setAllowed(false);
            setLoading(false);
            return;
        }

        setAllowed(true);

        let studentIds: string[] | null = null;

        if (!isAdmin) {
            const { data: teacherStudentData, error: teacherStudentError } = await supabase
                .from("teacher_students")
                .select("student_id")
                .eq("teacher_id", user.id);

            if (teacherStudentError) {
                alert(teacherStudentError.message);
            }

            studentIds = (teacherStudentData || []).map(
                (row: TeacherStudentAccess) => row.student_id
            );
        }

        let profileQuery = supabase
            .from("profiles")
            .select("id, username, is_admin, role, show_on_leaderboard")
            .order("username", { ascending: true });

        if (studentIds) {
            if (studentIds.length === 0) {
                setProfiles([]);
                setSessions([]);
                setPosts([]);
                setLoading(false);
                return;
            }

            profileQuery = profileQuery.in("id", studentIds);
        }

        const { data: profileData, error: profileError } = await profileQuery;

        if (profileError) {
            alert(profileError.message);
        }

        const visibleStudentIds = (profileData || [])
            .filter((profile) => !profile.is_admin && profile.role !== "teacher")
            .map((profile) => profile.id);

        if (visibleStudentIds.length === 0) {
            setProfiles(profileData || []);
            setSessions([]);
            setPosts([]);
            setLoading(false);
            return;
        }

        const today = todayString();

        const { data: sessionData, error: sessionError } = await supabase
            .from("study_sessions")
            .select("*")
            .in("user_id", visibleStudentIds)
            .gte("date", yesterdayString())
            .order("date", { ascending: true })
            .order("start_time", { ascending: true });

        if (sessionError) {
            alert(sessionError.message);
        }

        const weekStart = weekStartString();

        const { data: postData, error: postError } = await supabase
            .from("study_posts")
            .select("*")
            .in("user_id", visibleStudentIds)
            .gte("date", weekStart)
            .order("created_at", { ascending: false });

        if (postError) {
            alert(postError.message);
        }

        setProfiles(profileData || []);
        setSessions(sessionData || []);
        setPosts(postData || []);
        setLoading(false);
    }

    function getUsername(userId: string) {
        return profiles.find((profile) => profile.id === userId)?.username || "Okänd elev";
    }

    async function logout() {
        await supabase.auth.signOut();
        window.location.href = "/login";
    }

    const today = todayString();
    const yesterday = yesterdayString();

    const activeSessions = sessions.filter((session) => session.status === "active");
    const pausedSessions = sessions.filter((session) => session.status === "paused");
    const doneTodaySessions = sessions.filter(
        (session) => session.status === "done" && session.date === today
    );
    const missedYesterdaySessions = sessions.filter(
        (session) => session.status === "missed" && session.date === yesterday
    );

    const leaderboardMap: Record<string, number> = {};

    posts.forEach((post) => {
        leaderboardMap[post.user_id] = (leaderboardMap[post.user_id] || 0) + post.duration;
    });

    const leaderboard = Object.entries(leaderboardMap)
        .filter(([id]) => {
            const profile = profiles.find((profile) => profile.id === id);

            if (!profile) return false;

            return profile.show_on_leaderboard ?? true;
        })
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    if (loading) {
        return (
            <main style={pageStyle(theme)}>
                <NavBar />
                <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                <p>Laddar elevöversikt...</p>
            </main>
        );
    }

    if (!allowed) {
        return (
            <main style={pageStyle(theme)}>
                <NavBar />
                <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                <h1>Inte tillåtet</h1>
                <p>Du har inte behörighet att se denna sida.</p>
            </main>
        );
    }

    return (
        <main style={pageStyle(theme)}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "18px",
                    flexWrap: "wrap",
                }}
            >
                <NavBar />

                <button
                    className="home-logout-button"
                    onClick={logout}
                    style={{
                        marginTop: "72px",
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "#fecaca",
                        border: "1px solid rgba(248, 113, 113, 0.45)",
                        padding: "11px 16px",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                >
                    Logga ut
                </button>
            </div>

            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />

            <h1>📊 Elevöversikt</h1>
            <p style={{ color: "#94a3b8" }}>
                Se vilka elever som pluggar just nu, vilka som är klara idag och vad som händer på Pepp.
            </p>

            <section style={summaryGridStyle}>
                <SummaryCard title="Aktiva pass nu" value={activeSessions.length} emoji="🟢" />
                <SummaryCard title="Pausade pass" value={pausedSessions.length} emoji="⏸️" />
                <SummaryCard title="Avslutade idag" value={doneTodaySessions.length} emoji="✅" />
                <SummaryCard title="Missade igår" value={missedYesterdaySessions.length} emoji="⚠️" />
            </section>

            <section style={layoutStyle}>
                <div style={{ display: "grid", gap: "18px" }}>
                    <SessionSection
                        title="🟢 Aktiva pass nu"
                        emptyText="Inga elever sitter i aktiva pass just nu."
                        sessions={activeSessions}
                        getUsername={getUsername}
                    />

                    <SessionSection
                        title="⏸️ Pausade pass"
                        emptyText="Inga pass är pausade just nu."
                        sessions={pausedSessions}
                        getUsername={getUsername}
                    />

                    <SessionSection
                        title="✅ Avslutade idag"
                        emptyText="Inga elever har avslutat pass idag ännu."
                        sessions={doneTodaySessions}
                        getUsername={getUsername}
                    />

                    <SessionSection
                        title="⚠️ Missade igår"
                        emptyText="Inga missade pass igår."
                        sessions={missedYesterdaySessions}
                        getUsername={getUsername}
                    />
                </div>

                <aside style={{ display: "grid", gap: "18px" }}>
                    <section style={cardStyle}>
                        <h2 style={{ marginTop: 0 }}>🏆 Veckans topp 3</h2>

                        {leaderboard.length === 0 ? (
                            <p style={{ color: "#94a3b8" }}>Ingen deltar i topplistan ännu.</p>
                        ) : (
                            leaderboard.map(([id, minutes], index) => (
                                <div key={id} style={rowStyle}>
                                    <strong>
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}{" "}
                                        {getUsername(id)}
                                    </strong>
                                    <span>{formatHours(minutes)}</span>
                                </div>
                            ))
                        )}
                    </section>

                    <section style={cardStyle}>
                        <h2 style={{ marginTop: 0 }}>🔥 Senaste Pepp</h2>

                        {posts.length === 0 ? (
                            <p style={{ color: "#94a3b8" }}>Inga Pepp-inlägg senaste veckan.</p>
                        ) : (
                            posts.slice(0, 6).map((post) => (
                                <Link
                                    key={post.id}
                                    href={`/pepp?post=${post.id}`}
                                    style={postLinkStyle}
                                >
                                    <strong>{getUsername(post.user_id)}</strong>

                                    <p style={{ margin: "6px 0", color: "#cbd5e1" }}>
                                        {post.post_type === "weekly_goal"
                                            ? post.title
                                            : `Studerade ${post.subject || "ett ämne"} i ${formatHours(post.duration)}`}
                                    </p>

                                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                                        {formatDate(post.date)}
                                    </span>
                                </Link>
                            ))
                        )}
                    </section>
                </aside>
            </section>
        </main>
    );
}

function SummaryCard({
    title,
    value,
    emoji,
}: {
    title: string;
    value: number;
    emoji: string;
}) {
    return (
        <div style={summaryCardStyle}>
            <p style={{ margin: 0, color: "#94a3b8", fontWeight: "bold" }}>
                {emoji} {title}
            </p>
            <h2 style={{ margin: "10px 0 0", fontSize: "34px" }}>{value}</h2>
        </div>
    );
}

function SessionSection({
    title,
    emptyText,
    sessions,
    getUsername,
}: {
    title: string;
    emptyText: string;
    sessions: StudySession[];
    getUsername: (userId: string) => string;
}) {
    return (
        <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>{title}</h2>

            {sessions.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>{emptyText}</p>
            ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                    {sessions.map((session) => (
                        <div key={session.id} style={rowStyle}>
                            <div>
                                <strong>{getUsername(session.user_id)}</strong>
                                <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>
                                    {session.subject} · {formatHours(session.duration)}
                                    {session.start_time ? ` · ${session.start_time}` : ""}
                                </p>

                                <p style={{ margin: "5px 0 0", color: "#cbd5e1", fontSize: "13px" }}>
                                    ⏱ {formatRemainingTime(session)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

const pageStyle = (theme: typeof THEMES[ThemeKey]) => ({
    minHeight: "100vh",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    background: theme.background,
    color: theme.text,
});

const summaryGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginTop: "22px",
};

const summaryCardStyle = {
    padding: "20px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148, 163, 184, 0.24)",
};

const layoutStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: "20px",
    alignItems: "start",
    marginTop: "22px",
};

const cardStyle = {
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
};

const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.16)",
};

const postLinkStyle = {
    display: "block",
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    color: "inherit",
    textDecoration: "none",
    marginBottom: "10px",
};

const smallLinkStyle = {
    color: "#93c5fd",
    textDecoration: "none",
    fontWeight: "bold",
    whiteSpace: "nowrap" as const,
};

const logoutButtonStyle = {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#fecaca",
    border: "1px solid rgba(248, 113, 113, 0.45)",
    padding: "11px 16px",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: "bold",
};