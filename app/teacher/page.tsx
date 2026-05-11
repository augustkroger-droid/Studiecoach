"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import ThemePicker from "@/components/ThemePicker";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";

type Profile = {
    id: string;
    username: string | null;
    role?: "student" | "teacher" | "admin" | null;
    created_at?: string;
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

type TeacherClassAccess = {
    id: string;
    teacher_id: string;
    class_id: string;
    created_at: string;
};

type TeacherStudentAccess = {
    id: string;
    teacher_id: string;
    student_id: string;
    created_at: string;
};

type TeacherOwnClass = {
    id: string;
    teacher_id: string;
    name: string;
    source_admin_class_id?: string | null;
    created_at: string;
};

type TeacherOwnClassStudent = {
    id: string;
    class_id: string;
    student_id: string;
    created_at: string;
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

export default function TeacherPage() {
    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];

    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [classes, setClasses] = useState<TeacherOwnClass[]>([]);
    const [classStudents, setClassStudents] = useState<TeacherOwnClassStudent[]>([]);
    const [newClassName, setNewClassName] = useState("");
    const [teacherClassAccess, setTeacherClassAccess] = useState<TeacherClassAccess[]>([]);
    const [teacherStudentAccess, setTeacherStudentAccess] = useState<TeacherStudentAccess[]>([]);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [posts, setPosts] = useState<StudyPost[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [openClassIds, setOpenClassIds] = useState<string[]>([]);

    useEffect(() => {
        loadTeacherData();
    }, []);

    async function loadTeacherData() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { data: myProfile } = await supabase
            .from("profiles")
            .select("role, is_admin")
            .eq("id", user.id)
            .single();

        const isTeacher = myProfile?.role === "teacher";
        const isAdmin = myProfile?.role === "admin" || myProfile?.is_admin;

        if (!isTeacher && !isAdmin) {
            setAllowed(false);
            setLoading(false);
            return;
        }

        setAllowed(true);

        const { data: teacherClassData, error: teacherClassError } = await supabase
            .from("teacher_classes")
            .select("*")
            .eq("teacher_id", user.id);

        if (teacherClassError) {
            alert(teacherClassError.message);
        }

        const { data: teacherStudentData, error: teacherStudentError } = await supabase
            .from("teacher_students")
            .select("*")
            .eq("teacher_id", user.id);

        if (teacherStudentError) {
            alert(teacherStudentError.message);
        }

        const directStudentIds = (teacherStudentData || []).map((row) => row.student_id);

        const { data: ownClassData, error: ownClassError } = await supabase
            .from("teacher_own_classes")
            .select("*")
            .eq("teacher_id", user.id)
            .order("name", { ascending: true });

        if (ownClassError) {
            alert(ownClassError.message);
        }

        const ownClassIds = (ownClassData || []).map((classItem) => classItem.id);

        let ownClassStudentData: TeacherOwnClassStudent[] = [];

        if (ownClassIds.length > 0) {
            const { data: studentRows, error: studentRowsError } = await supabase
                .from("teacher_own_class_students")
                .select("*")
                .in("class_id", ownClassIds);

            if (studentRowsError) {
                alert(studentRowsError.message);
            }

            ownClassStudentData = studentRows || [];
        }

        const classStudentIds = ownClassStudentData.map((row) => row.student_id);
        const allStudentIds = Array.from(new Set([...classStudentIds, ...directStudentIds]));

        let profileData: Profile[] = [];
        let sessionData: StudySession[] = [];
        let postData: StudyPost[] = [];

        if (allStudentIds.length > 0) {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, role, created_at")
                .in("id", allStudentIds)
                .order("username", { ascending: true });

            if (error) alert(error.message);
            profileData = data || [];

            const { data: sessionsRaw, error: sessionsError } = await supabase
                .from("study_sessions")
                .select("*")
                .in("user_id", allStudentIds)
                .order("date", { ascending: false });

            if (sessionsError) alert(sessionsError.message);
            sessionData = sessionsRaw || [];

            const { data: postsRaw, error: postsError } = await supabase
                .from("study_posts")
                .select("*")
                .in("user_id", allStudentIds)
                .order("created_at", { ascending: false });

            if (postsError) alert(postsError.message);
            postData = postsRaw || [];
        }

        setTeacherClassAccess(teacherClassData || []);
        setTeacherStudentAccess(teacherStudentData || []);
        setClasses(ownClassData || []);
        setClassStudents(ownClassStudentData);
        setProfiles(profileData);
        setSessions(sessionData);
        setPosts(postData);
        setSelectedUserId(profileData[0]?.id || null);
        setOpenClassIds([]);
        setLoading(false);
    }

    function toggleClassOpen(classId: string) {
        setOpenClassIds((current) =>
            current.includes(classId)
                ? current.filter((id) => id !== classId)
                : [...current, classId]
        );
    }

    function getUsername(userId: string) {
        return profiles.find((profile) => profile.id === userId)?.username || "Okänd användare";
    }

    function isStudentInTeacherClass(studentId: string) {
        return classStudents.some((row) => row.student_id === studentId);
    }

    async function createTeacherClass() {
        const name = newClassName.trim();

        if (!name) return;

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { error } = await supabase
            .from("teacher_own_classes")
            .insert({
                teacher_id: user.id,
                name,
            });

        if (error) {
            alert(error.message);
            return;
        }

        setNewClassName("");
        loadTeacherData();
    }

    async function addStudentToTeacherClass(studentId: string, classId: string) {
        if (!classId) return;

        const alreadyInClass = classStudents.some((row) => row.student_id === studentId);

        if (alreadyInClass) {
            alert("Eleven ligger redan i en klass. Ta bort eleven från den klassen först.");
            return;
        }

        const { error } = await supabase
            .from("teacher_own_class_students")
            .insert({
                class_id: classId,
                student_id: studentId,
            });

        if (error) {
            alert(error.message);
            return;
        }

        loadTeacherData();
    }

    async function removeStudentFromTeacherClass(rowId: string) {
        const { error } = await supabase
            .from("teacher_own_class_students")
            .delete()
            .eq("id", rowId);

        if (error) {
            alert(error.message);
            return;
        }

        loadTeacherData();
    }

    async function deleteTeacherClass(classId: string) {
        const confirmed = window.confirm(
            "Vill du ta bort klassmappen? Eleverna tas inte bort, bara själva mappen."
        );

        if (!confirmed) return;

        const { error } = await supabase
            .from("teacher_own_classes")
            .delete()
            .eq("id", classId);

        if (error) {
            alert(error.message);
            return;
        }

        loadTeacherData();
    }

    const ungroupedStudents = profiles
        .filter((profile) => !isStudentInTeacherClass(profile.id))
        .sort((a, b) => (a.username || "").localeCompare(b.username || "", "sv"));

    const selectedProfile = profiles.find((profile) => profile.id === selectedUserId) || null;
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
        subjectTotals[session.subject] = (subjectTotals[session.subject] || 0) + session.duration;
    });

    const mostStudiedSubject = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1])[0];

    if (loading) {
        return (
            <main style={pageStyle(theme)}>
                <NavBar />
                <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                <p>Laddar lärarsida...</p>
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

            <h1>👩‍🏫 Lärarsida</h1>
            <p style={{ color: "#94a3b8" }}>
                Här ser du de klasser och elever som en admin har delat med dig.
            </p>

            <section style={teacherLayoutStyle}>
                <section style={cardStyle}>
                    <h2>Mina elever</h2>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                        <input
                            value={newClassName}
                            onChange={(event) => setNewClassName(event.target.value)}
                            placeholder="Ny klass, t.ex. 8A"
                            style={inputStyle}
                        />

                        <button onClick={createTeacherClass} style={primaryButtonStyle}>
                            Skapa klass
                        </button>
                    </div>

                    {classes.length === 0 && ungroupedStudents.length === 0 ? (
                        <p style={{ color: "#94a3b8" }}>
                            Du har inte fått några elever ännu.
                        </p>
                    ) : (
                        <>
                            {classes.map((classItem) => {
                                const studentsInClass = classStudents
                                    .filter((row) => row.class_id === classItem.id)
                                    .map((row) =>
                                        profiles.find((profile) => profile.id === row.student_id)
                                    )
                                    .filter(Boolean) as Profile[];

                                return (
                                    <div key={classItem.id} style={classBoxStyle}>
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
                                                onClick={() => toggleClassOpen(classItem.id)}
                                                style={classFolderButtonStyle}
                                            >
                                                {openClassIds.includes(classItem.id) ? "📂" : "📁"}{" "}
                                                {classItem.name}
                                            </button>

                                            <button
                                                onClick={() => deleteTeacherClass(classItem.id)}
                                                style={dangerSmallButtonStyle}
                                            >
                                                Ta bort
                                            </button>
                                        </div>

                                        {openClassIds.includes(classItem.id) && (
                                            <div style={{ marginTop: "12px" }}>
                                                {studentsInClass.length === 0 ? (
                                                    <p style={{ color: "#94a3b8", margin: 0 }}>
                                                        Inga elever i klassen.
                                                    </p>
                                                ) : (
                                                    studentsInClass.map((student) => {
                                                        const classRow = classStudents.find(
                                                            (row) =>
                                                                row.class_id === classItem.id &&
                                                                row.student_id === student.id
                                                        );

                                                        return (
                                                            <div key={student.id} style={classStudentRowStyle}>
                                                                <button
                                                                    onClick={() => setSelectedUserId(student.id)}
                                                                    style={{
                                                                        ...studentButtonStyle,
                                                                        border:
                                                                            selectedUserId === student.id
                                                                                ? "1px solid rgba(96, 165, 250, 0.8)"
                                                                                : "1px solid rgba(148, 163, 184, 0.18)",
                                                                        background:
                                                                            selectedUserId === student.id
                                                                                ? "rgba(37, 99, 235, 0.2)"
                                                                                : "rgba(15, 23, 42, 0.72)",
                                                                    }}
                                                                >
                                                                    {student.username || "Elev utan namn"}
                                                                </button>

                                                                {classRow && (
                                                                    <button
                                                                        onClick={() => removeStudentFromTeacherClass(classRow.id)}
                                                                        style={dangerSmallButtonStyle}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {ungroupedStudents.length > 0 && (
                                <div style={classBoxStyle}>
                                    <strong>Övriga elever</strong>

                                    <div style={{ marginTop: "12px" }}>
                                        {ungroupedStudents.map((student) => (
                                            <div key={student.id}>
                                                <button
                                                    onClick={() => setSelectedUserId(student.id)}
                                                    style={{
                                                        ...studentButtonStyle,
                                                        border:
                                                            selectedUserId === student.id
                                                                ? "1px solid rgba(96, 165, 250, 0.8)"
                                                                : "1px solid rgba(148, 163, 184, 0.18)",
                                                        background:
                                                            selectedUserId === student.id
                                                                ? "rgba(37, 99, 235, 0.2)"
                                                                : "rgba(15, 23, 42, 0.72)",
                                                    }}
                                                >
                                                    {student.username || "Elev utan namn"}
                                                </button>

                                                <select
                                                    defaultValue=""
                                                    onChange={(event) => {
                                                        addStudentToTeacherClass(student.id, event.target.value);
                                                        event.currentTarget.value = "";
                                                    }}
                                                    style={selectStyle}
                                                >
                                                    <option value="" disabled>
                                                        Lägg i klass...
                                                    </option>

                                                    {classes.map((classItem) => (
                                                        <option key={classItem.id} value={classItem.id}>
                                                            {classItem.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>

                <section style={cardStyle}>
                    <h2>Elevvy</h2>

                    {!selectedProfile ? (
                        <p style={{ color: "#94a3b8" }}>Välj en elev.</p>
                    ) : (
                        <>
                            <section style={profileCardStyle}>
                                <p style={{ margin: 0, color: "#94a3b8" }}>Elev</p>
                                <h1 style={{ margin: "8px 0 0" }}>
                                    {selectedProfile.username || "Elev utan namn"}
                                </h1>
                            </section>

                            <section style={gridStyle}>
                                <StatCard title="Total studietid" value={formatHours(totalMinutes)} />
                                <StatCard title="Genomförda pass" value={`${totalDonePasses}`} />
                                <StatCard title="Aktiva studiedagar" value={`${activeDays}`} />
                                <StatCard
                                    title="Snitt per aktiv dag"
                                    value={formatHours(averagePerActiveDay)}
                                />
                                <StatCard title="Fokusnivå" value={`${focusLevel}%`} />
                                <StatCard
                                    title="Mest studerade ämne"
                                    value={mostStudiedSubject ? mostStudiedSubject[0] : "Inget ännu"}
                                    subValue={
                                        mostStudiedSubject
                                            ? formatHours(mostStudiedSubject[1])
                                            : ""
                                    }
                                />
                            </section>

                            <section style={chartCardStyle}>
                                <h2 style={{ marginTop: 0 }}>
                                    Snitt per veckodag senaste månaden
                                </h2>

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
                                <h2 style={{ marginTop: 0 }}>Elevens Pepp-inlägg</h2>

                                {selectedPosts.length === 0 ? (
                                    <p style={{ color: "#94a3b8" }}>Inga inlägg ännu.</p>
                                ) : (
                                    selectedPosts.map((post) => (
                                        <PostCard
                                            key={post.id}
                                            post={post}
                                            username={getUsername(post.user_id)}
                                        />
                                    ))
                                )}
                            </section>
                        </>
                    )}
                </section>
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
                                color:
                                    star <= post.rating!
                                        ? "#fbbf24"
                                        : "rgba(148, 163, 184, 0.35)",
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

const teacherLayoutStyle = {
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

const classBoxStyle = {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    marginBottom: "12px",
};

const classFolderButtonStyle = {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#e2e8f0",
    fontWeight: "bold",
    cursor: "pointer",
    textAlign: "left" as const,
    padding: 0,
    fontSize: "16px",
};

const studentButtonStyle = {
    width: "100%",
    textAlign: "left" as const,
    padding: "11px 12px",
    borderRadius: "12px",
    color: "#e2e8f0",
    cursor: "pointer",
    marginBottom: "8px",
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

const dangerSmallButtonStyle = {
    padding: "7px 9px",
    borderRadius: "10px",
    border: "1px solid rgba(248, 113, 113, 0.45)",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#fecaca",
    fontWeight: "bold",
    cursor: "pointer",
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

const classStudentRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
};