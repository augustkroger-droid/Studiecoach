"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

type Profile = {
    id: string;
    username: string | null;
    username_locked?: boolean | null;
    is_admin?: boolean;
    role?: "student" | "teacher" | "admin" | null;
    created_at?: string;
    show_on_leaderboard?: boolean;
    pepp_blocked_until?: string | null;
    pepp_block_reason?: string | null;
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

function sortProfilesByUsername(a: Profile, b: Profile) {
    return (a.username || "zzz").localeCompare(b.username || "zzz", "sv", {
        sensitivity: "base",
    });
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
    const [teacherClassAccess, setTeacherClassAccess] = useState<TeacherClassAccess[]>([]);
    const [teacherStudentAccess, setTeacherStudentAccess] = useState<TeacherStudentAccess[]>([]);
    const [newClassName, setNewClassName] = useState("");
    const [openClassIds, setOpenClassIds] = useState<string[]>([]);

    const [adminUsernameInput, setAdminUsernameInput] = useState("");
    const [savingAdminUsername, setSavingAdminUsername] = useState(false);

    const [teacherAccessEditor, setTeacherAccessEditor] = useState<Profile | null>(null);
    const [selectedTeacherClassIds, setSelectedTeacherClassIds] = useState<string[]>([]);
    const [selectedTeacherStudentIds, setSelectedTeacherStudentIds] = useState<string[]>([]);
    const [openTeacherAccessClassIds, setOpenTeacherAccessClassIds] = useState<string[]>([]);
    const [teacherAccessOtherUsersOpen, setTeacherAccessOtherUsersOpen] = useState(false);
    const [savingTeacherAccess, setSavingTeacherAccess] = useState(false);

    useEffect(() => {
        loadAdminData();
    }, []);

    useEffect(() => {
        const selectedProfile = profiles.find((profile) => profile.id === selectedUserId);
        setAdminUsernameInput(selectedProfile?.username || "");
    }, [selectedUserId, profiles]);

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

        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select(
                "id, username, username_locked, is_admin, role, created_at, show_on_leaderboard, pepp_blocked_until, pepp_block_reason"
            )
            .order("username", { ascending: true });

        if (profileError) {
            alert(profileError.message);
        }

        const { data: sessionData, error: sessionError } = await supabase
            .rpc("get_admin_study_sessions");

        if (sessionError) {
            alert(sessionError.message);
        }

        const { data: postData, error: postError } = await supabase
            .from("study_posts")
            .select("*")
            .order("created_at", { ascending: false });

        if (postError) {
            alert(postError.message);
        }

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

        const { data: teacherClassAccessData, error: teacherClassAccessError } = await supabase
            .from("teacher_classes")
            .select("*");

        if (teacherClassAccessError) {
            alert(teacherClassAccessError.message);
        }

        const { data: teacherStudentAccessData, error: teacherStudentAccessError } = await supabase
            .from("teacher_students")
            .select("*");

        if (teacherStudentAccessError) {
            alert(teacherStudentAccessError.message);
        }

        setProfiles([...(profileData || [])].sort(sortProfilesByUsername));

        const sortedSessionData = ((sessionData || []) as StudySession[]).sort(
            (a, b) => String(b.date).localeCompare(String(a.date))
        );

        setSessions(sortedSessionData);
        setPosts(postData || []);
        setAdminClasses(classData || []);
        setClassStudents(classStudentData || []);
        setTeacherClassAccess(teacherClassAccessData || []);
        setTeacherStudentAccess(teacherStudentAccessData || []);
        setSelectedUserId((currentSelectedUserId) => {
            if (
                currentSelectedUserId &&
                (profileData || []).some((profile) => profile.id === currentSelectedUserId)
            ) {
                return currentSelectedUserId;
            }

            return profileData?.[0]?.id || null;
        });
        setLoading(false);
    }

    function getUsername(userId: string) {
        return profiles.find((profile) => profile.id === userId)?.username || "Okänd användare";
    }

    function isPeppBlocked(profile: Profile) {
        if (!profile.pepp_blocked_until) return false;
        return new Date(profile.pepp_blocked_until) > new Date();
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

    async function moveUserToClass(studentId: string, classId: string) {
        if (classId === "none") {
            const existingRow = classStudents.find((row) => row.student_id === studentId);

            if (!existingRow) return;

            const { error } = await supabase
                .from("admin_class_students")
                .delete()
                .eq("id", existingRow.id);

            if (error) {
                alert(error.message);
                return;
            }

            loadAdminData();
            return;
        }

        const existingRow = classStudents.find((row) => row.student_id === studentId);

        if (existingRow?.class_id === classId) {
            alert("Användaren ligger redan i den mappen.");
            return;
        }

        if (existingRow) {
            const { error } = await supabase
                .from("admin_class_students")
                .update({
                    class_id: classId,
                })
                .eq("id", existingRow.id);

            if (error) {
                alert(error.message);
                return;
            }

            loadAdminData();
            return;
        }

        const { error } = await supabase
            .from("admin_class_students")
            .insert({
                class_id: classId,
                student_id: studentId,
            });

        if (error) {
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

        const secondConfirm = window.confirm(
            "Är du helt säker? Detta tar bara bort klassmappen."
        );

        if (!secondConfirm) return;

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

    async function deleteUser(userId: string, username: string | null) {
        if (!username) {
            alert("Användaren saknar användarnamn och kan inte tas bort här.");
            return;
        }

        const typedUsername = window.prompt(
            `För att ta bort användaren permanent, skriv användarnamnet exakt:\n\n${username}`
        );

        if (typedUsername !== username) {
            alert("Användarnamnet stämde inte. Användaren togs inte bort.");
            return;
        }

        const confirmed = window.confirm(
            `Är du helt säker på att du vill ta bort ${username}? Detta går inte att ångra.`
        );

        if (!confirmed) return;

        console.log("Försöker ta bort:", { userId, username });
        const response = await fetch("/api/admin/delete-user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        console.log("Delete response:", data);

        if (!response.ok) {
            console.error("Delete user error:", data);
            alert(data.error || "Kunde inte ta bort användaren.");
            return;
        }

        console.log("Delete user success:", data);

        alert("Användaren togs bort.");
        setSelectedUserId(null);
        loadAdminData();
    }

    async function saveAdminUsername() {
        if (!selectedProfile) return;

        const nextUsername = adminUsernameInput.trim();

        if (!nextUsername) return;

        if (nextUsername.length < 3) {
            alert("Användarnamnet måste vara minst 3 tecken.");
            return;
        }

        const existingUser = profiles.find(
            (profile) =>
                profile.id !== selectedProfile.id &&
                (profile.username || "").toLowerCase() === nextUsername.toLowerCase()
        );

        if (existingUser) {
            alert("Det användarnamnet är redan upptaget.");
            return;
        }

        setSavingAdminUsername(true);

        const { error } = await supabase
            .from("profiles")
            .update({
                username: nextUsername,
            })
            .eq("id", selectedProfile.id);

        setSavingAdminUsername(false);

        if (error) {
            alert(error.message);
            return;
        }

        setProfiles((current) =>
            current.map((profile) =>
                profile.id === selectedProfile.id
                    ? { ...profile, username: nextUsername }
                    : profile
            )
        );

        alert("Användarnamn uppdaterat.");
    }

    async function toggleUsernameLock(userId: string, nextValue: boolean) {
        const confirmed = window.confirm(
            nextValue
                ? "Låsa användarens möjlighet att byta användarnamn?"
                : "Låsa upp användarens möjlighet att byta användarnamn?"
        );

        if (!confirmed) return;

        const { error } = await supabase
            .from("profiles")
            .update({
                username_locked: nextValue,
            })
            .eq("id", userId);

        if (error) {
            alert(error.message);
            return;
        }

        setProfiles((current) =>
            current.map((profile) =>
                profile.id === userId
                    ? { ...profile, username_locked: nextValue }
                    : profile
            )
        );
    }

    async function blockUserFromPepp(userIdToBlock: string, days: number) {
        const confirmed = window.confirm(`Blockera användaren från Pepp i ${days} dagar?`);
        if (!confirmed) return;

        const blockedUntil = new Date();
        blockedUntil.setDate(blockedUntil.getDate() + days);

        const { error } = await supabase
            .from("profiles")
            .update({
                pepp_blocked_until: blockedUntil.toISOString(),
                pepp_block_reason: "Blockerad av admin",
            })
            .eq("id", userIdToBlock);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminData();
    }

    async function unblockUserFromPepp(userIdToUnblock: string) {
        const confirmed = window.confirm("Ta bort Pepp-blockeringen?");
        if (!confirmed) return;

        const { error } = await supabase
            .from("profiles")
            .update({
                pepp_blocked_until: null,
                pepp_block_reason: null,
            })
            .eq("id", userIdToUnblock);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminData();
    }

    function openTeacherAccessEditor(teacher: Profile) {
        setTeacherAccessEditor(teacher);

        setSelectedTeacherClassIds(
            teacherClassAccess
                .filter((row) => row.teacher_id === teacher.id)
                .map((row) => row.class_id)
        );

        setSelectedTeacherStudentIds(
            teacherStudentAccess
                .filter((row) => row.teacher_id === teacher.id)
                .map((row) => row.student_id)
        );

        setOpenTeacherAccessClassIds([]);
        setTeacherAccessOtherUsersOpen(false);
    }

    function closeTeacherAccessEditor() {
        setTeacherAccessEditor(null);
        setSelectedTeacherClassIds([]);
        setSelectedTeacherStudentIds([]);
        setOpenTeacherAccessClassIds([]);
        setTeacherAccessOtherUsersOpen(false);
    }

    function toggleTeacherAccessClassOpen(classId: string) {
        setOpenTeacherAccessClassIds((current) =>
            current.includes(classId)
                ? current.filter((id) => id !== classId)
                : [...current, classId]
        );
    }

    function toggleTeacherClassFolder(classId: string) {
        setSelectedTeacherClassIds((current) =>
            current.includes(classId)
                ? current.filter((id) => id !== classId)
                : [...current, classId]
        );
    }

    function toggleTeacherStudent(studentId: string) {
        setSelectedTeacherStudentIds((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId]
        );
    }

    function toggleAllTeacherStudentsInClass(studentIds: string[]) {
        const allSelected =
            studentIds.length > 0 &&
            studentIds.every((studentId) => selectedTeacherStudentIds.includes(studentId));

        setSelectedTeacherStudentIds((current) => {
            if (allSelected) {
                return current.filter((studentId) => !studentIds.includes(studentId));
            }

            return Array.from(new Set([...current, ...studentIds]));
        });
    }

    async function saveTeacherAccessEditor() {
        if (!teacherAccessEditor) return;

        setSavingTeacherAccess(true);

        const teacherId = teacherAccessEditor.id;

        const { error: deleteTeacherClassesError } = await supabase
            .from("teacher_classes")
            .delete()
            .eq("teacher_id", teacherId);

        if (deleteTeacherClassesError) {
            setSavingTeacherAccess(false);
            alert(deleteTeacherClassesError.message);
            return;
        }

        const { error: deleteTeacherStudentsError } = await supabase
            .from("teacher_students")
            .delete()
            .eq("teacher_id", teacherId);

        if (deleteTeacherStudentsError) {
            setSavingTeacherAccess(false);
            alert(deleteTeacherStudentsError.message);
            return;
        }

        const { data: oldTeacherOwnClasses, error: oldOwnClassesError } = await supabase
            .from("teacher_own_classes")
            .select("id, source_admin_class_id")
            .eq("teacher_id", teacherId)
            .not("source_admin_class_id", "is", null);

        if (oldOwnClassesError) {
            setSavingTeacherAccess(false);
            alert(oldOwnClassesError.message);
            return;
        }

        const oldSyncedTeacherOwnClassIds = (oldTeacherOwnClasses || []).map((row) => row.id);

        if (oldSyncedTeacherOwnClassIds.length > 0) {
            const { error: deleteOldClassStudentsError } = await supabase
                .from("teacher_own_class_students")
                .delete()
                .in("class_id", oldSyncedTeacherOwnClassIds);

            if (deleteOldClassStudentsError) {
                setSavingTeacherAccess(false);
                alert(deleteOldClassStudentsError.message);
                return;
            }

            const { error: deleteOldClassesError } = await supabase
                .from("teacher_own_classes")
                .delete()
                .in("id", oldSyncedTeacherOwnClassIds);

            if (deleteOldClassesError) {
                setSavingTeacherAccess(false);
                alert(deleteOldClassesError.message);
                return;
            }
        }

        if (selectedTeacherClassIds.length > 0) {
            const teacherClassRows = selectedTeacherClassIds.map((classId) => ({
                teacher_id: teacherId,
                class_id: classId,
            }));

            const { error } = await supabase
                .from("teacher_classes")
                .insert(teacherClassRows);

            if (error) {
                setSavingTeacherAccess(false);
                alert(error.message);
                return;
            }
        }

        if (selectedTeacherStudentIds.length > 0) {
            const teacherStudentRows = selectedTeacherStudentIds.map((studentId) => ({
                teacher_id: teacherId,
                student_id: studentId,
            }));

            const { error } = await supabase
                .from("teacher_students")
                .insert(teacherStudentRows);

            if (error) {
                setSavingTeacherAccess(false);
                alert(error.message);
                return;
            }
        }

        for (const adminClassId of selectedTeacherClassIds) {
            const adminClass = adminClasses.find((classItem) => classItem.id === adminClassId);

            if (!adminClass) continue;

            const { data: createdTeacherClass, error: createTeacherClassError } = await supabase
                .from("teacher_own_classes")
                .insert({
                    teacher_id: teacherId,
                    name: adminClass.name,
                    source_admin_class_id: adminClass.id,
                })
                .select("id")
                .single();

            if (createTeacherClassError) {
                setSavingTeacherAccess(false);
                alert(createTeacherClassError.message);
                return;
            }

            const studentIdsInAdminClass = classStudents
                .filter((row) => row.class_id === adminClass.id)
                .map((row) => row.student_id)
                .filter((studentId) => selectedTeacherStudentIds.includes(studentId));

            if (studentIdsInAdminClass.length > 0) {
                const teacherOwnClassStudentRows = studentIdsInAdminClass.map((studentId) => ({
                    class_id: createdTeacherClass.id,
                    student_id: studentId,
                }));

                const { error: classStudentError } = await supabase
                    .from("teacher_own_class_students")
                    .insert(teacherOwnClassStudentRows);

                if (classStudentError) {
                    setSavingTeacherAccess(false);
                    alert(classStudentError.message);
                    return;
                }
            }
        }

        setSavingTeacherAccess(false);
        closeTeacherAccessEditor();
        loadAdminData();
    }

    async function setUserRole(userId: string, role: "student" | "teacher" | "admin") {
        const confirmed = window.confirm(`Ändra roll till ${role}?`);

        if (!confirmed) return;

        const { error } = await supabase
            .from("profiles")
            .update({
                role,
                is_admin: role === "admin",
            })
            .eq("id", userId);

        if (error) {
            alert(error.message);
            return;
        }

        setProfiles((current) =>
            current.map((profile) =>
                profile.id === userId
                    ? { ...profile, role, is_admin: role === "admin" }
                    : profile
            )
        );
    }

    function getTeachers() {
        return profiles
            .filter((profile) => profile.role === "teacher" || profile.is_admin)
            .sort((a, b) => (a.username || "").localeCompare(b.username || "", "sv"));
    }

    function teacherCanSeeClass(teacherId: string, classId: string) {
        return teacherClassAccess.some(
            (row) => row.teacher_id === teacherId && row.class_id === classId
        );
    }

    function teacherCanSeeStudent(teacherId: string, studentId: string) {
        return teacherStudentAccess.some(
            (row) => row.teacher_id === teacherId && row.student_id === studentId
        );
    }

    const selectedProfile = profiles.find((profile) => profile.id === selectedUserId) || null;

    const sortedProfiles = [...profiles]
        .filter((profile) => !isStudentInAnyClass(profile.id))
        .sort(sortProfilesByUsername);

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
                Se användare, klassmappar, profiler, statistik och Pepp-inlägg.
            </p>

            <section className="admin-layout" style={adminLayoutStyle}>
                <section style={cardStyle}>

                    <div
                        className="admin-create-class-row"
                        style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
                    >
                        <input
                            value={newClassName}
                            onChange={(event) => setNewClassName(event.target.value)}
                            placeholder="Ny mapp, t.ex. 8A"
                            style={inputStyle}
                        />

                        <button onClick={createClass} style={primaryButtonStyle}>
                            Skapa mapp
                        </button>
                    </div>

                    {adminClasses.length > 0 && (
                        <div style={{ marginBottom: "20px" }}>
                            <h3 style={{ marginBottom: "10px" }}>Mappar</h3>

                            {adminClasses.map((adminClass) => {
                                const studentsInClass = classStudents
                                    .filter((row) => row.class_id === adminClass.id)
                                    .sort((a, b) => {
                                        const studentA = profiles.find((profile) => profile.id === a.student_id);
                                        const studentB = profiles.find((profile) => profile.id === b.student_id);

                                        return sortProfilesByUsername(
                                            studentA || ({ id: a.student_id, username: null } as Profile),
                                            studentB || ({ id: b.student_id, username: null } as Profile)
                                        );
                                    });

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
                                                {openClassIds.includes(adminClass.id) ? "📂" : "📁"}{" "}
                                                {adminClass.name}
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
                                    <div
                                        style={{
                                            color: "#94a3b8",
                                            fontSize: "12px",
                                            marginTop: "4px",
                                        }}
                                    >
                                        {profile.created_at
                                            ? new Date(profile.created_at).toLocaleDateString("sv-SE")
                                            : "Okänt datum"}
                                    </div>
                                </div>

                                <span>
                                    {profile.role === "admin"
                                        ? "Admin"
                                        : profile.role === "teacher"
                                            ? "Lärare"
                                            : "Elev"}
                                </span>
                            </button>
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
                                    <p style={{ margin: 0, color: "#94a3b8" }}>
                                        Användarnamn
                                    </p>

                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "10px",
                                            marginTop: "10px",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <input
                                            value={adminUsernameInput}
                                            onChange={(event) =>
                                                setAdminUsernameInput(event.target.value)
                                            }
                                            placeholder="Användarnamn"
                                            style={{
                                                ...inputStyle,
                                                maxWidth: "320px",
                                                fontSize: "22px",
                                                fontWeight: "bold",
                                            }}
                                        />

                                        <button
                                            onClick={saveAdminUsername}
                                            disabled={
                                                savingAdminUsername ||
                                                adminUsernameInput.trim() === selectedProfile.username
                                            }
                                            style={{
                                                ...primaryButtonStyle,
                                                opacity:
                                                    savingAdminUsername ||
                                                        adminUsernameInput.trim() === selectedProfile.username
                                                        ? 0.55
                                                        : 1,
                                            }}
                                        >
                                            {savingAdminUsername ? "Sparar..." : "Spara namn"}
                                        </button>
                                    </div>

                                    <div
                                        style={{
                                            marginTop: "18px",
                                            padding: "14px",
                                            borderRadius: "16px",
                                            background: "rgba(15, 23, 42, 0.65)",
                                            border: "1px solid rgba(148, 163, 184, 0.22)",
                                        }}
                                    >
                                        <strong>Roll och mapp</strong>

                                        <select
                                            value={selectedProfile.role || "student"}
                                            onChange={(event) =>
                                                setUserRole(
                                                    selectedProfile.id,
                                                    event.target.value as "student" | "teacher" | "admin"
                                                )
                                            }
                                            style={selectStyle}
                                        >
                                            <option value="student">Elev</option>
                                            <option value="teacher">Lärare</option>
                                            <option value="admin">Admin</option>
                                        </select>

                                        <select
                                            value={
                                                classStudents.find((row) => row.student_id === selectedProfile.id)?.class_id || "none"
                                            }
                                            onChange={(event) => {
                                                moveUserToClass(selectedProfile.id, event.target.value);
                                            }}
                                            style={selectStyle}
                                        >
                                            <option value="none">Ingen mapp</option>

                                            {adminClasses.map((adminClass) => (
                                                <option key={adminClass.id} value={adminClass.id}>
                                                    {adminClass.name}
                                                </option>
                                            ))}
                                        </select>

                                        {selectedProfile.role === "teacher" || selectedProfile.is_admin ? (
                                            <button
                                                onClick={() => openTeacherAccessEditor(selectedProfile)}
                                                style={{
                                                    ...primaryButtonStyle,
                                                    width: "100%",
                                                    marginTop: "10px",
                                                }}
                                            >
                                                Hantera elevåtkomst
                                            </button>
                                        ) : null}
                                    </div>

                                    <label
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            marginTop: "14px",
                                            color: "#cbd5e1",
                                            fontWeight: "bold",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedProfile.username_locked ?? false}
                                            onChange={(event) =>
                                                toggleUsernameLock(
                                                    selectedProfile.id,
                                                    event.target.checked
                                                )
                                            }
                                            style={{
                                                width: "16px",
                                                height: "16px",
                                                cursor: "pointer",
                                            }}
                                        />

                                        Lås användarens möjlighet att byta namn
                                    </label>

                                    <div
                                        style={{
                                            marginTop: "18px",
                                            padding: "14px",
                                            borderRadius: "16px",
                                            background: isPeppBlocked(selectedProfile)
                                                ? "rgba(239, 68, 68, 0.13)"
                                                : "rgba(15, 23, 42, 0.65)",
                                            border: isPeppBlocked(selectedProfile)
                                                ? "1px solid rgba(248, 113, 113, 0.45)"
                                                : "1px solid rgba(148, 163, 184, 0.22)",
                                        }}
                                    >
                                        <strong>
                                            {isPeppBlocked(selectedProfile)
                                                ? "🚫 Blockerad från Pepp"
                                                : "✅ Kan posta på Pepp"}
                                        </strong>

                                        {selectedProfile.pepp_blocked_until && (
                                            <p
                                                style={{
                                                    margin: "6px 0 0",
                                                    color: "#94a3b8",
                                                    fontSize: "14px",
                                                }}
                                            >
                                                Blockerad till:{" "}
                                                {new Date(
                                                    selectedProfile.pepp_blocked_until
                                                ).toLocaleString("sv-SE")}
                                            </p>
                                        )}

                                        <div
                                            className="admin-block-buttons"
                                            style={{
                                                display: "flex",
                                                gap: "8px",
                                                marginTop: "12px",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            {isPeppBlocked(selectedProfile) ? (
                                                <button
                                                    onClick={() =>
                                                        unblockUserFromPepp(selectedProfile.id)
                                                    }
                                                    style={primaryButtonStyle}
                                                >
                                                    Ta bort blockering
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() =>
                                                            blockUserFromPepp(selectedProfile.id, 1)
                                                        }
                                                        style={dangerSmallButtonStyle}
                                                    >
                                                        Blockera 1 dag
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            blockUserFromPepp(selectedProfile.id, 7)
                                                        }
                                                        style={dangerSmallButtonStyle}
                                                    >
                                                        Blockera 7 dagar
                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            blockUserFromPepp(selectedProfile.id, 30)
                                                        }
                                                        style={dangerSmallButtonStyle}
                                                    >
                                                        Blockera 30 dagar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: "18px",
                                            padding: "14px",
                                            borderRadius: "16px",
                                            background: "rgba(239, 68, 68, 0.10)",
                                            border: "1px solid rgba(248, 113, 113, 0.45)",
                                        }}
                                    >
                                        <strong style={{ color: "#fecaca" }}>OBS!</strong>

                                        <p style={{ color: "#fecaca", marginTop: "8px", fontSize: "14px" }}>
                                            Detta tar bort användaren permanent. Du måste skriva användarnamnet exakt innan borttagningen sker.
                                        </p>

                                        <button
                                            onClick={() => deleteUser(selectedProfile.id, selectedProfile.username)}
                                            style={dangerSmallButtonStyle}
                                        >
                                            Ta bort användare permanent
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="admin-stats-grid" style={gridStyle}>
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

                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "12px",
                                    }}
                                >
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

            <section style={cardStyle}>
                <h2>Alla Pepp-inlägg</h2>

                {posts.length === 0 ? (
                    <p style={{ color: "#94a3b8" }}>Inga inlägg ännu.</p>
                ) : (
                    posts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            username={getUsername(post.user_id)}
                        />
                    ))
                )}
            </section>
            {teacherAccessEditor && (
                <TeacherAccessEditorModal
                    teacher={teacherAccessEditor}
                    adminClasses={adminClasses}
                    classStudents={classStudents}
                    profiles={profiles}
                    selectedClassIds={selectedTeacherClassIds}
                    selectedStudentIds={selectedTeacherStudentIds}
                    openClassIds={openTeacherAccessClassIds}
                    otherUsersOpen={teacherAccessOtherUsersOpen}
                    saving={savingTeacherAccess}
                    closeModal={closeTeacherAccessEditor}
                    toggleClassOpen={toggleTeacherAccessClassOpen}
                    toggleClassFolder={toggleTeacherClassFolder}
                    toggleStudent={toggleTeacherStudent}
                    toggleAllStudentsInClass={toggleAllTeacherStudentsInClass}
                    setOtherUsersOpen={setTeacherAccessOtherUsersOpen}
                    saveTeacherAccess={saveTeacherAccessEditor}
                    isStudentInAnyClass={isStudentInAnyClass}
                />
            )}
        </main>
    );
}

function StudentCheckbox({
    checked,
    label,
    onChange,
}: {
    checked: boolean;
    label: string;
    onChange: () => void;
}) {
    return (
        <label
            style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                borderRadius: "12px",
                background: checked ? "rgba(37, 99, 235, 0.2)" : "rgba(15, 23, 42, 0.6)",
                border: checked
                    ? "1px solid rgba(96, 165, 250, 0.75)"
                    : "1px solid rgba(148, 163, 184, 0.18)",
                cursor: "pointer",
            }}
        >
            <input type="checkbox" checked={checked} onChange={onChange} />

            <span style={{ fontWeight: "bold" }}>{label}</span>
        </label>
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

function TeacherAccessPicker({
    teachers,
    selectedTeacherIds,
    onAdd,
    onRemove,
}: {
    teachers: Profile[];
    selectedTeacherIds: string[];
    onAdd: (teacherId: string) => void;
    onRemove: (teacherId: string) => void;
}) {
    const availableTeachers = teachers.filter(
        (teacher) => !selectedTeacherIds.includes(teacher.id)
    );

    const selectedTeachers = teachers.filter((teacher) =>
        selectedTeacherIds.includes(teacher.id)
    );

    return (
        <div>
            <select
                defaultValue=""
                onChange={(event) => {
                    if (!event.target.value) return;
                    onAdd(event.target.value);
                    event.currentTarget.value = "";
                }}
                style={selectStyle}
            >
                <option value="" disabled>
                    Lägg till lärare...
                </option>

                {availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                        {teacher.username || "Lärare utan namn"}
                    </option>
                ))}
            </select>

            <div style={{ marginTop: "10px" }}>
                {selectedTeachers.length === 0 ? (
                    <p style={{ color: "#94a3b8", margin: 0 }}>
                        Inga lärare valda.
                    </p>
                ) : (
                    selectedTeachers.map((teacher) => (
                        <span key={teacher.id} style={accessPillStyle}>
                            {teacher.username || "Lärare utan namn"}

                            <button
                                onClick={() => onRemove(teacher.id)}
                                style={pillRemoveButtonStyle}
                                title="Ta bort åtkomst"
                            >
                                ×
                            </button>
                        </span>
                    ))
                )}
            </div>
        </div>
    );
}

function TeacherAccessEditorModal({
    teacher,
    adminClasses,
    classStudents,
    profiles,
    selectedClassIds,
    selectedStudentIds,
    openClassIds,
    otherUsersOpen,
    saving,
    closeModal,
    toggleClassOpen,
    toggleClassFolder,
    toggleStudent,
    toggleAllStudentsInClass,
    setOtherUsersOpen,
    saveTeacherAccess,
    isStudentInAnyClass,
}: any) {
    return (
        <div onClick={closeModal} style={modalOverlayStyle}>
            <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "14px",
                        alignItems: "flex-start",
                    }}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>Redigera elever</h2>
                        <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>
                            {teacher.username || "Lärare utan namn"}
                        </p>
                    </div>

                    <button onClick={closeModal} style={secondaryButtonStyle}>
                        ✕
                    </button>
                </div>

                <p style={{ color: "#cbd5e1", marginTop: "18px" }}>
                    Välj vilka klassmappar läraren ska se och vilka elever som ska ligga i dem.
                    Nya elever som läggs till senare markeras inte automatiskt.
                </p>

                <div style={{ display: "grid", gap: "12px" }}>
                    {adminClasses.map((adminClass: AdminClass) => {
                        const studentRows = classStudents
                            .filter((row: AdminClassStudent) => row.class_id === adminClass.id)
                            .sort((a: AdminClassStudent, b: AdminClassStudent) => {
                                const studentA = profiles.find((profile: Profile) => profile.id === a.student_id);
                                const studentB = profiles.find((profile: Profile) => profile.id === b.student_id);

                                return sortProfilesByUsername(
                                    studentA || ({ id: a.student_id, username: null } as Profile),
                                    studentB || ({ id: b.student_id, username: null } as Profile)
                                );
                            });

                        const studentIds = studentRows.map(
                            (row: AdminClassStudent) => row.student_id
                        );

                        const isOpen = openClassIds.includes(adminClass.id);
                        const folderSelected = selectedClassIds.includes(adminClass.id);

                        const allStudentsSelected =
                            studentIds.length > 0 &&
                            studentIds.every((studentId: string) =>
                                selectedStudentIds.includes(studentId)
                            );

                        return (
                            <div key={adminClass.id} style={classBoxStyle}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "10px",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <button
                                        onClick={() => toggleClassOpen(adminClass.id)}
                                        style={classFolderButtonStyle}
                                    >
                                        {isOpen ? "📂" : "📁"} {adminClass.name}
                                        <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
                                            ({studentRows.length})
                                        </span>
                                    </button>

                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <button
                                            onClick={() => toggleClassFolder(adminClass.id)}
                                            style={folderSelected ? primaryButtonStyle : secondaryButtonStyle}
                                        >
                                            {folderSelected ? "Mapp vald" : "Välj mapp"}
                                        </button>

                                        {studentRows.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (!folderSelected) {
                                                        toggleClassFolder(adminClass.id);
                                                    }

                                                    toggleAllStudentsInClass(studentIds);
                                                }}
                                                style={secondaryButtonStyle}
                                            >
                                                {allStudentsSelected
                                                    ? "Avmarkera elever"
                                                    : "Markera hela klassen"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isOpen && (
                                    <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                                        {studentRows.length === 0 ? (
                                            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
                                                Inga elever i klassen.
                                            </p>
                                        ) : (
                                            studentRows.map((row: AdminClassStudent) => {
                                                const student = profiles.find(
                                                    (profile: Profile) => profile.id === row.student_id
                                                );

                                                return (
                                                    <StudentCheckbox
                                                        key={row.id}
                                                        checked={selectedStudentIds.includes(row.student_id)}
                                                        label={student?.username || "Okänd användare"}
                                                        onChange={() => {
                                                            if (!folderSelected) {
                                                                toggleClassFolder(adminClass.id);
                                                            }

                                                            toggleStudent(row.student_id);
                                                        }}
                                                    />
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {(() => {
                        const otherUsers = profiles
                            .filter((profile: Profile) => !profile.is_admin)
                            .filter((profile: Profile) => !isStudentInAnyClass(profile.id))
                            .sort((a: Profile, b: Profile) =>
                                (a.username || "").localeCompare(b.username || "", "sv")
                            );

                        return (
                            <div style={classBoxStyle}>
                                <button
                                    onClick={() => setOtherUsersOpen((current: boolean) => !current)}
                                    style={classFolderButtonStyle}
                                >
                                    {otherUsersOpen ? "📂" : "📁"} Övriga elever utan klass
                                    <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
                                        ({otherUsers.length})
                                    </span>
                                </button>

                                {otherUsersOpen && (
                                    <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                                        {otherUsers.length === 0 ? (
                                            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
                                                Inga övriga elever.
                                            </p>
                                        ) : (
                                            otherUsers.map((student: Profile) => (
                                                <StudentCheckbox
                                                    key={student.id}
                                                    checked={selectedStudentIds.includes(student.id)}
                                                    label={student.username || "Inget användarnamn"}
                                                    onChange={() => toggleStudent(student.id)}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                <div style={modalFooterStyle}>
                    <span style={{ color: "#94a3b8", fontWeight: "bold" }}>
                        {selectedClassIds.length} mapp(ar) · {selectedStudentIds.length} elev(er)
                    </span>

                    <button
                        onClick={saveTeacherAccess}
                        disabled={saving}
                        style={{
                            ...primaryButtonStyle,
                            opacity: saving ? 0.6 : 1,
                        }}
                    >
                        {saving ? "Sparar..." : "Spara åtkomst"}
                    </button>
                </div>
            </div>
        </div>
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

const smallToggleButtonStyle = {
    padding: "7px 9px",
    borderRadius: "999px",
    fontWeight: "bold",
    cursor: "pointer",
    marginRight: "6px",
    marginBottom: "6px",
};

const accessPillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "rgba(34, 197, 94, 0.16)",
    border: "1px solid rgba(74, 222, 128, 0.45)",
    color: "#bbf7d0",
    fontWeight: "bold",
    marginRight: "6px",
    marginBottom: "6px",
};

const pillRemoveButtonStyle = {
    border: "none",
    background: "transparent",
    color: "#bbf7d0",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: 1,
};

const secondaryButtonStyle = {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    background: "rgba(30, 41, 59, 0.8)",
    color: "#e2e8f0",
    fontWeight: "bold",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
};

const modalOverlayStyle = {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.62)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
    padding: "18px",
};

const modalStyle = {
    width: "700px",
    maxWidth: "100%",
    maxHeight: "82vh",
    overflowY: "auto" as const,
    background: "#0f172a",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
};

const modalFooterStyle = {
    position: "sticky" as const,
    bottom: "-22px",
    margin: "18px -22px -22px",
    padding: "14px 22px",
    background: "rgba(15, 23, 42, 0.96)",
    borderTop: "1px solid rgba(148, 163, 184, 0.22)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap" as const,
};