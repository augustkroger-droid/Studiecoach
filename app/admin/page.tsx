"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

type Profile = {
    id: string;
    username: string | null;
    is_admin?: boolean;
    created_at?: string;
    show_on_leaderboard?: boolean;
};

type StudySession = {
    id: string;
    user_id: string;
    subject: string;
    duration: number;
    date: string;
    status: "planned" | "active" | "paused" | "done" | "missed";
};

type StudyPost = {
    id: string;
    user_id: string;
    subject: string;
    duration: number;
    comment: string | null;
    rating?: number | null;
    date: string;
    created_at: string;
    post_type?: string | null;
    title?: string | null;
};

type AdminClass = {
    id: string;
    admin_id: string;
    name: string;
    created_at: string;
};

type AdminClassStudent = {
    id: string;
    class_id: string;
    student_id: string;
    created_at: string;
};

const weekDays = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

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

export default function AdminPage() {
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
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const [adminClasses, setAdminClasses] = useState<AdminClass[]>([]);
    const [classStudents, setClassStudents] = useState<AdminClassStudent[]>([]);
    const [newClassName, setNewClassName] = useState("");
    const [openClassIds, setOpenClassIds] = useState<string[]>([]);

    useEffect(() => {
        loadAdminData();
    }, []);

    async function loadAdminData() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { data: myProfile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .single();

        if (!myProfile?.is_admin) {
            setAllowed(false);
            setLoading(false);
            return;
        }

        setAllowed(true);
        const currentAdminId = user.id;

        const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, is_admin, created_at, show_on_leaderboard")
            .order("username", { ascending: true });

        const { data: sessionData, error: sessionError } = await supabase
            .rpc("get_admin_study_sessions");

        if (sessionError) {
            alert(sessionError.message);
        }

        const { data: postData, error: postError } = await supabase
            .from("study_posts")
            .select("*")
            .order("created_at", { ascending: false });



        const { data: classData, error: classError } = await supabase
            .from("admin_classes")
            .select("*")
            .eq("admin_id", currentAdminId)
            .order("name", { ascending: true });

        if (classError) {
            alert(classError.message);
        }

        const { data: classStudentData, error: classStudentError } = await supabase
            .from("admin_class_students")
            .select("*");

        if (classStudentError) {
            alert(classStudentError.message);
        }

        if (postError) {
            alert(postError.message);
        }

        setProfiles(profileData || []);
        const sortedSessionData = ((sessionData || []) as StudySession[]).sort(
            (a: StudySession, b: StudySession) =>
                String(b.date).localeCompare(String(a.date))
        );

        setSessions(sortedSessionData);
        setPosts(postData || []);
        setAdminClasses(classData || []);
        setClassStudents(classStudentData || []);
        setSelectedUserId(profileData?.[0]?.id || null);
        setLoading(false);
    }

    function getUsername(userId: string) {
        return profiles.find((profile) => profile.id === userId)?.username || "Okänd användare";
    }

    function isStudentInAnyClass(studentId: string) {
        return classStudents.some((row) => row.student_id === studentId);
    }

    function toggleClassOpen(classId: string) {
        setOpenClassIds((current) =>
            current.includes(classId)
                ? current.filter((id) => id !== classId)
                : [...current, classId]
        );
    }

    async function createClass() {
        const name = newClassName.trim();

        if (!name) return;

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { error } = await supabase
            .from("admin_classes")
            .insert({
                admin_id: user.id,
                name,
            });

        if (error) {
            alert(error.message);
            return;
        }

        setNewClassName("");
        loadAdminData();
    }

    async function addStudentToClass(studentId: string, classId: string) {
        if (!classId) return;

        if (isStudentInAnyClass(studentId)) {
            alert("Eleven ligger redan i en klass. Ta bort eleven från den klassen först.");
            return;
        }

        const { error } = await supabase
            .from("admin_class_students")
            .insert({
                class_id: classId,
                student_id: studentId,
            });

        if (error) {
            if (error.code === "23505") {
                alert("Eleven finns redan i den klassen.");
                return;
            }

            alert(error.message);
            return;
        }

        loadAdminData();
    }

    async function removeStudentFromClass(rowId: string) {
        const { error } = await supabase
            .from("admin_class_students")
            .delete()
            .eq("id", rowId);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminData();
    }

    async function deleteClass(classId: string) {
        const confirmed = window.confirm(
            "Vill du ta bort klassen? Eleverna tas inte bort, bara själva klassmappen."
        );

        if (!confirmed) return;

        const { error } = await supabase
            .from("admin_classes")
            .delete()
            .eq("id", classId);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminData();
    }

    const selectedProfile = profiles.find((profile) => profile.id === selectedUserId) || null;
    const sortedProfiles = [...profiles]
        .filter((profile) => !isStudentInAnyClass(profile.id))
        .sort((a, b) =>
            (a.username || "").localeCompare(b.username || "", "sv")
        );
    const selectedSessions = sessions.filter((session) => session.user_id === selectedUserId);
    const selectedPosts = posts.filter((post) => post.user_id === selectedUserId);

    const doneSessions = selectedSessions.filter((session) => session.status === "done");
    const missedSessions = selectedSessions.filter((session) => session.status === "missed");

    const totalMinutes = doneSessions.reduce((sum, session) => sum + session.duration, 0);
    const totalDonePasses = doneSessions.length;
    const totalMissedPasses = missedSessions.length;

    const focusLevel =
        totalDonePasses + totalMissedPasses === 0
            ? 0
            : Math.round((totalDonePasses / (totalDonePasses + totalMissedPasses)) * 100);

    const activeDays = new Set(doneSessions.map((session) => session.date)).size;
    const averagePerActiveDay = activeDays === 0 ? 0 : Math.round(totalMinutes / activeDays);

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
            <main style={pageStyle(theme)}>
                <NavBar />
                <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                <p>Laddar admin...</p>
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
            <NavBar />
            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />



            <h1>🛠 Admin</h1>
            <p style={{ color: "#94a3b8" }}>
                Se alla användare, deras profiler och alla Pepp-inlägg.
            </p>

            <section style={adminLayoutStyle}>
                <section style={cardStyle}>
                    <h2>Användare</h2>

                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                        <input
                            value={newClassName}
                            onChange={(event) => setNewClassName(event.target.value)}
                            placeholder="Ny klass, t.ex. 8A"
                            style={inputStyle}
                        />

                        <button onClick={createClass} style={primaryButtonStyle}>
                            Skapa klass
                        </button>
                    </div>

                    {adminClasses.length > 0 && (
                        <div style={{ marginBottom: "20px" }}>
                            <h3 style={{ marginBottom: "10px" }}>Klasser</h3>

                            {adminClasses.map((adminClass) => {
                                const studentsInClass = classStudents.filter(
                                    (row) => row.class_id === adminClass.id
                                );

                                return (
                                    <div key={adminClass.id} style={classBoxStyle}>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: "8px",
                                                marginBottom: "10px",
                                            }}
                                        >
                                            <button
                                                onClick={() => toggleClassOpen(adminClass.id)}
                                                style={classFolderButtonStyle}
                                            >
                                                {openClassIds.includes(adminClass.id) ? "📂" : "📁"} {adminClass.name}
                                            </button>

                                            <button
                                                onClick={() => deleteClass(adminClass.id)}
                                                style={dangerSmallButtonStyle}
                                            >
                                                Ta bort
                                            </button>
                                        </div>

                                        {openClassIds.includes(adminClass.id) && (
                                            <>
                                                {studentsInClass.length === 0 ? (
                                                    <p style={{ color: "#94a3b8", margin: 0 }}>
                                                        Inga elever i klassen ännu.
                                                    </p>
                                                ) : (
                                                    studentsInClass.map((row) => {
                                                        const student = profiles.find(
                                                            (profile) => profile.id === row.student_id
                                                        );

                                                        return (
                                                            <div key={row.id} style={classStudentRowStyle}>
                                                                <button
                                                                    onClick={() => setSelectedUserId(row.student_id)}
                                                                    style={classStudentButtonStyle}
                                                                >
                                                                    {student?.username || "Okänd användare"}
                                                                </button>

                                                                <button
                                                                    onClick={() => removeStudentFromClass(row.id)}
                                                                    style={dangerSmallButtonStyle}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <h3>Övriga användare</h3>

                    {sortedProfiles.map((profile) => (
                        <div key={profile.id} style={{ marginBottom: "10px" }}>
                            <button
                                onClick={() => setSelectedUserId(profile.id)}
                                style={{
                                    ...userButtonStyle,
                                    border:
                                        selectedUserId === profile.id
                                            ? "1px solid rgba(96, 165, 250, 0.8)"
                                            : "1px solid rgba(148, 163, 184, 0.18)",
                                    background:
                                        selectedUserId === profile.id
                                            ? "rgba(37, 99, 235, 0.2)"
                                            : "rgba(30, 41, 59, 0.7)",
                                }}
                            >
                                <div>
                                    <strong>{profile.username || "Inget användarnamn"}</strong>
                                    <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
                                        {profile.created_at
                                            ? new Date(profile.created_at).toLocaleDateString("sv-SE")
                                            : "Okänt datum"}
                                    </div>
                                </div>

                                {profile.is_admin && <span>Admin</span>}
                            </button>

                            <select
                                defaultValue=""
                                onChange={(event) => {
                                    addStudentToClass(profile.id, event.target.value);
                                    event.currentTarget.value = "";
                                }}
                                style={selectStyle}
                            >
                                <option value="" disabled>
                                    Lägg i klass...
                                </option>

                                {adminClasses.map((adminClass) => (
                                    <option key={adminClass.id} value={adminClass.id}>
                                        {adminClass.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </section>

                <section style={cardStyle}>
                    <h2>Profilvy</h2>

                    {!selectedProfile ? (
                        <p style={{ color: "#94a3b8" }}>Välj en användare.</p>
                    ) : (
                        <>
                            <section style={profileCardStyle}>
                                <div>
                                    <p style={{ margin: 0, color: "#94a3b8" }}>Användarnamn</p>
                                    <h2 style={{ margin: "6px 0 0", fontSize: "32px" }}>
                                        {selectedProfile.username || "Okänt användarnamn"}
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

                            <section style={chartCardStyle}>
                                <h2 style={{ marginTop: 0 }}>Användarens Pepp-inlägg</h2>

                                {selectedPosts.length === 0 ? (
                                    <p style={{ color: "#94a3b8" }}>Inga inlägg ännu.</p>
                                ) : (
                                    selectedPosts.map((post) => (
                                        <PostCard key={post.id} post={post} username={getUsername(post.user_id)} />
                                    ))
                                )}
                            </section>
                        </>
                    )}
                </section>
            </section>

            <section style={cardStyle}>
                <h2>Alla Pepp-inlägg</h2>

                {posts.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>Inga inlägg ännu.</p>
                ) : (
                    posts.map((post) => (
                        <PostCard key={post.id} post={post} username={getUsername(post.user_id)} />
                    ))
                )}
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

function PostCard({ post, username }: { post: StudyPost; username: string }) {
    return (
        <article style={postCardStyle}>
            <strong>{username}</strong>

            <p style={{ margin: "8px 0 0", color: "#cbd5e1", fontWeight: "bold" }}>
                {post.post_type === "weekly_goal"
                    ? post.title
                    : `Studerade ${post.subject || "ett ämne"} i ${formatHours(post.duration)}`}
            </p>

            {post.rating && (
                <div style={{ marginTop: "8px", display: "flex", gap: "3px" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <span
                            key={star}
                            style={{
                                color: star <= post.rating! ? "#fbbf24" : "rgba(148, 163, 184, 0.35)",
                                fontSize: "19px",
                                lineHeight: 1,
                            }}
                        >
                            ★
                        </span>
                    ))}
                </div>
            )}

            {post.comment && (
                <p
                    style={{
                        margin: "14px 0 0",
                        padding: "12px",
                        borderRadius: "12px",
                        background: "rgba(15, 23, 42, 0.75)",
                        color: "#e2e8f0",
                    }}
                >
                    “{post.comment}”
                </p>
            )}

            <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "8px" }}>
                {formatDate(post.date)}
            </div>
        </article>
    );
}

const pageStyle = (theme: typeof THEMES[ThemeKey]) => ({
    minHeight: "100vh",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    background: theme.background,
    color: theme.text,
});

const adminLayoutStyle = {
    display: "grid",
    gridTemplateColumns: "340px minmax(0, 1fr)",
    gap: "20px",
    alignItems: "start",
};

const cardStyle = {
    marginTop: "24px",
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
};

const userButtonStyle = {
    width: "100%",
    padding: "14px",
    borderRadius: "14px",
    marginBottom: "10px",
    color: "#e2e8f0",
    cursor: "pointer",
    textAlign: "left" as const,
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
};

const profileCardStyle = {
    marginTop: "12px",
    padding: "28px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.85)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
};

const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginTop: "20px",
};

const statCardStyle = {
    padding: "22px",
    borderRadius: "18px",
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
};

const chartCardStyle = {
    marginTop: "20px",
    padding: "24px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
};

const postCardStyle = {
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(30, 41, 59, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    marginBottom: "14px",
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    background: "rgba(2, 6, 23, 0.75)",
    color: "white",
    boxSizing: "border-box" as const,
};

const primaryButtonStyle = {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "none",
    background: "#2563eb",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
};

const selectStyle = {
    width: "100%",
    marginTop: "6px",
    padding: "9px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    background: "rgba(2, 6, 23, 0.75)",
    color: "#e2e8f0",
};

const classBoxStyle = {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    marginBottom: "12px",
};

const classStudentRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "8px",
};

const classStudentButtonStyle = {
    flex: 1,
    textAlign: "left" as const,
    padding: "9px 10px",
    borderRadius: "10px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "rgba(15, 23, 42, 0.72)",
    color: "#e2e8f0",
    cursor: "pointer",
};

const dangerSmallButtonStyle = {
    padding: "7px 9px",
    borderRadius: "10px",
    border: "1px solid rgba(248, 113, 113, 0.45)",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#fecaca",
    fontWeight: "bold",
    cursor: "pointer",
};

const classFolderButtonStyle = {
    border: "none",
    background: "transparent",
    color: "#e2e8f0",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "left" as const,
    padding: 0,
    fontSize: "15px",
};