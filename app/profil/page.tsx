"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

type StudySession = {
    id: string;
    subject: string;
    duration: number;
    date: string;
    status: "planned" | "active" | "paused" | "done" | "missed";
};

type Profile = {
    username: string;
};

const weekDays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

function getStartOfWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function formatDate(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function formatHours(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
    if (hours > 0) return `${hours} h`;
    return `${mins} min`;
}

export default function ProfilPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { data: profileData } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();

        const { data: sessionData, error } = await supabase
            .from("study_sessions")
            .select("id, subject, duration, date, status")
            .eq("user_id", user.id);

        if (error) {
            alert(error.message);
            return;
        }

        setProfile(profileData);
        setSessions(sessionData || []);
        setLoading(false);
    }

    const doneSessions = sessions.filter((session) => session.status === "done");
    const missedSessions = sessions.filter((session) => session.status === "missed");

    const totalMinutes = doneSessions.reduce(
        (sum, session) => sum + session.duration,
        0
    );

    const totalDonePasses = doneSessions.length;
    const totalMissedPasses = missedSessions.length;

    const focusLevel =
        totalDonePasses + totalMissedPasses === 0
            ? 0
            : Math.round((totalDonePasses / (totalDonePasses + totalMissedPasses)) * 100);

    const activeDays = new Set(doneSessions.map((session) => session.date)).size;

    const averagePerActiveDay =
        activeDays === 0 ? 0 : Math.round(totalMinutes / activeDays);

    const startOfWeek = getStartOfWeek();

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    fourWeeksAgo.setHours(0, 0, 0, 0);

    const sessionsLastMonth = doneSessions.filter((session) => {
        const sessionDate = new Date(session.date);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate >= fourWeeksAgo;
    });

    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < 28; i++) {
        const date = new Date(fourWeeksAgo);
        date.setDate(fourWeeksAgo.getDate() + i);

        const jsDay = date.getDay();
        const mondayIndex = jsDay === 0 ? 6 : jsDay - 1;

        weekdayCounts[mondayIndex] += 1;
    }

    sessionsLastMonth.forEach((session) => {
        const date = new Date(session.date);
        const jsDay = date.getDay();
        const mondayIndex = jsDay === 0 ? 6 : jsDay - 1;

        weekdayTotals[mondayIndex] += session.duration;
    });

    const averageMinutesPerWeekday = weekdayTotals.map((total, index) =>
        Math.round(total / Math.max(weekdayCounts[index], 1))
    );

    const maxAverageMinutes = Math.max(...averageMinutesPerWeekday, 1);


    const subjectTotals: Record<string, number> = {};

    doneSessions.forEach((session) => {
        subjectTotals[session.subject] =
            (subjectTotals[session.subject] || 0) + session.duration;
    });

    const mostStudiedSubject = Object.entries(subjectTotals).sort(
        (a, b) => b[1] - a[1]
    )[0];

    if (loading) {
        return (
            <main style={pageStyle}>
                <NavBar />
                <p>Laddar profil...</p>
            </main>
        );
    }

    return (
        <main style={pageStyle}>
            <NavBar />

            <h1 style={{ fontSize: "36px", marginBottom: "4px" }}>👤 Profil</h1>
            <p style={{ marginTop: 0, color: "#94a3b8" }}>
                Se din statistik och dina framsteg.
            </p>

            <section style={profileCardStyle}>
                <div>
                    <p style={{ margin: 0, color: "#94a3b8" }}>Användarnamn</p>
                    <h2 style={{ margin: "6px 0 0", fontSize: "32px" }}>
                        {profile?.username || "Okänt användarnamn"}
                    </h2>
                </div>
            </section>

            <section style={gridStyle}>
                <StatCard title="Total studietid" value={formatHours(totalMinutes)} />
                <StatCard title="Genomförda pass" value={`${totalDonePasses}`} />
                <StatCard title="Aktiva studiedagar" value={`${activeDays}`} />
                <StatCard title="Snitt per aktiv dag" value={formatHours(averagePerActiveDay)} />
                <StatCard title="Fokusnivå" value={`${focusLevel}%`} />
                <StatCard
                    title="Mest studerade ämne"
                    value={mostStudiedSubject ? mostStudiedSubject[0] : "Inget ännu"}
                    subValue={mostStudiedSubject ? formatHours(mostStudiedSubject[1]) : ""}
                />
            </section>

            <section style={chartCardStyle}>
                <h2 style={{ marginTop: 0 }}>Snitt per veckodag senaste månaden</h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {averageMinutesPerWeekday.map((minutes, index) => (
                        <div key={weekDays[index]}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginBottom: "6px",
                                    fontWeight: "bold",
                                }}
                            >
                                <span>{weekDays[index]}</span>
                                <span>{formatHours(minutes)}</span>
                            </div>

                            <div
                                style={{
                                    height: "14px",
                                    background: "rgba(148, 163, 184, 0.2)",
                                    borderRadius: "999px",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${(minutes / maxAverageMinutes) * 100}%`,
                                        background: "#2563eb",
                                        borderRadius: "999px",
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}

function StatCard({
    title,
    value,
    subValue,
}: {
    title: string;
    value: string;
    subValue?: string;
}) {
    return (
        <div style={statCardStyle}>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>{title}</p>

            <h2 style={{ margin: "8px 0 0", fontSize: "24px" }}>{value}</h2>

            {subValue && (
                <p style={{ margin: "6px 0 0", color: "#94a3b8", fontWeight: "bold" }}>
                    {subValue}
                </p>
            )}
        </div>
    );
}

const pageStyle = {
    minHeight: "100vh",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    background:
        "linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%)",
    color: "#e2e8f0",
};

const profileCardStyle = {
    marginTop: "24px",
    padding: "28px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.85)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    boxShadow: "0 20px 45px rgba(0,0,0,0.35)",
};

const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginTop: "20px",
};

const statCardStyle = {
    padding: "22px",
    borderRadius: "18px",
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "0 14px 32px rgba(0,0,0,0.28)",
};

const chartCardStyle = {
    marginTop: "20px",
    padding: "24px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "0 14px 32px rgba(0,0,0,0.28)",
};