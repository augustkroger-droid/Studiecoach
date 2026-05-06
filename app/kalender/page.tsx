"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

const days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

const examColors = [
    { name: "Blå", value: "#3b82f6" },
    { name: "Lila", value: "#8b5cf6" },
    { name: "Rosa", value: "#ec4899" },
    { name: "Orange", value: "#f97316" },
    { name: "Grön", value: "#22c55e" },
    { name: "Turkos", value: "#14b8a6" },
];

type StudySession = {
    id: string;
    subject: string;
    duration: number;
    date: string;
    status?: "planned" | "active" | "paused" | "done" | "missed";
    remaining_seconds?: number | null;
    sort_order: number;
    start_time?: string | null;
    end_time?: string | null;
};

type Exam = {
    id: string;
    user_id: string;
    name: string;
    date: string;
    color: string;
    created_at?: string;
};

type PopupMode = null | "session" | "exam";

function getStartOfWeek(offset: number) {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + offset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getWeekNumber(date: Date) {
    const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    return Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function KalenderPage() {
    const [weekOffset, setWeekOffset] = useState(0);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [popupMode, setPopupMode] = useState<PopupMode>(null);

    const [subject, setSubject] = useState("");
    const [minutes, setMinutes] = useState("");
    const [startTime, setStartTime] = useState("");
    const [isEditingSession, setIsEditingSession] = useState(false);

    const [goalHours, setGoalHours] = useState("");
    const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(0);

    const [examName, setExamName] = useState("");
    const [examDate, setExamDate] = useState("");
    const [examColor, setExamColor] = useState(examColors[0].value);
    const [isEditingExam, setIsEditingExam] = useState(false);

    const [draggedSession, setDraggedSession] = useState<StudySession | null>(null);
    const [dragOverSessionId, setDragOverSessionId] = useState<string | null>(null);
    const [dragPreviewDate, setDragPreviewDate] = useState<string | null>(null);
    const [dragTargetSession, setDragTargetSession] = useState<StudySession | null>(null);
    const isDragging = useRef(false);
    const weekSwitchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startOfWeek = getStartOfWeek(weekOffset);
    const weekNumber = getWeekNumber(startOfWeek);

    useEffect(() => {
        loadSessions();
        loadExams();
        loadWeeklyGoal();
    }, [weekOffset]);

    function getCurrentWeekStartString() {
        return formatDate(getStartOfWeek(0));
    }

    async function loadWeeklyGoal() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) return;

        const { data } = await supabase
            .from("weekly_goals")
            .select("*")
            .eq("user_id", user.id)
            .eq("week_start", getCurrentWeekStartString())
            .maybeSingle();

        if (data) {
            setWeeklyGoalMinutes(data.goal_minutes);
            setGoalHours(String(data.goal_minutes / 60));
        }
    }

    async function saveWeeklyGoal() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user || !goalHours) return;

        const minutes = Math.round(Number(goalHours) * 60);

        const { error } = await supabase
            .from("weekly_goals")
            .upsert(
                {
                    user_id: user.id,
                    week_start: getCurrentWeekStartString(),
                    goal_minutes: minutes,
                },
                {
                    onConflict: "user_id,week_start",
                }
            );

        if (error) {
            alert(error.message);
            return;
        }

        setWeeklyGoalMinutes(minutes);
    }

    async function loadSessions() {
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const { data, error } = await supabase
            .from("study_sessions")
            .select("*")
            .gte("date", formatDate(startOfWeek))
            .lte("date", formatDate(endOfWeek))
            .order("date", { ascending: true })
            .order("sort_order", { ascending: true });

        if (error) {
            alert(error.message);
            return;
        }

        const sessionsFromDb = data || [];

        const updatedSessions = await Promise.all(
            sessionsFromDb.map(async (session) => {
                if (session.status === "active" && isBeforeToday(session.date)) {
                    const plannedSeconds = session.duration * 60;
                    const remainingSeconds = session.remaining_seconds ?? plannedSeconds;
                    const studiedSeconds = plannedSeconds - remainingSeconds;
                    const actualMinutes = Math.max(1, Math.round(studiedSeconds / 60));

                    await supabase
                        .from("study_sessions")
                        .update({
                            status: "done",
                            duration: actualMinutes,
                            remaining_seconds: null,
                        })
                        .eq("id", session.id);

                    return {
                        ...session,
                        status: "done" as const,
                        duration: actualMinutes,
                        remaining_seconds: null,
                    };
                }

                if (
                    session.status !== "done" &&
                    session.status !== "active" &&
                    isBeforeToday(session.date)
                ) {
                    await supabase
                        .from("study_sessions")
                        .update({ status: "missed" })
                        .eq("id", session.id);

                    return {
                        ...session,
                        status: "missed" as const,
                    };
                }

                return session;
            })
        );

        setSessions(updatedSessions);
    }

    async function loadExams() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) return;

        const { data, error } = await supabase
            .from("exams")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: true });

        if (error) {
            alert(error.message);
            return;
        }

        setExams(data || []);
    }

    function openAddPopup(date: Date) {
        setSelectedSession(null);
        setSelectedExam(null);
        setSelectedDate(date);
        setPopupMode(null);
        setSubject("");
        setMinutes("");
        setStartTime("");
        setExamName("");
        setExamDate(formatDate(date));
        setExamColor(examColors[0].value);
        setIsEditingSession(false);
        setIsEditingExam(false);
    }

    function openEditPopup(session: StudySession) {
        setSelectedDate(null);
        setSelectedExam(null);
        setSelectedSession(session);
        setPopupMode("session");
        setSubject(session.subject);
        setMinutes(String(session.duration));
        setStartTime(session.start_time || "");

        setIsEditingSession(false);
        setIsEditingExam(false);
    }

    function openExamPopup(exam: Exam) {
        setSelectedDate(null);
        setSelectedSession(null);
        setSelectedExam(exam);
        setPopupMode("exam");
        setExamName(exam.name);
        setExamDate(exam.date);
        setExamColor(exam.color);
        setIsEditingExam(false);
        setIsEditingSession(false);
    }

    function closePopup() {
        setSelectedDate(null);
        setSelectedSession(null);
        setSelectedExam(null);
        setPopupMode(null);
        setSubject("");
        setMinutes("");
        setStartTime("");
        setExamName("");
        setExamDate("");
        setExamColor(examColors[0].value);
        setIsEditingSession(false);
        setIsEditingExam(false);
    }

    function switchWeekWhileDragging(direction: "previous" | "next") {
        if (!draggedSession) return;
        if (weekSwitchTimeout.current) return;

        weekSwitchTimeout.current = setTimeout(() => {
            setWeekOffset((current) =>
                direction === "next" ? current + 1 : current - 1
            );

            weekSwitchTimeout.current = null;
        }, 700);
    }

    function cancelWeekSwitch() {
        if (weekSwitchTimeout.current) {
            clearTimeout(weekSwitchTimeout.current);
            weekSwitchTimeout.current = null;
        }
    }

    async function addSession() {
        if (!selectedDate || !subject || !minutes) return;

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const selectedDateString = formatDate(selectedDate);

        const sessionsSameDay = sessions.filter(
            (session) => session.date === selectedDateString
        );

        const nextSortOrder =
            sessionsSameDay.length > 0
                ? Math.max(...sessionsSameDay.map((session) => session.sort_order ?? 0)) + 1
                : 0;

        const { error } = await supabase.from("study_sessions").insert({
            user_id: user.id,
            subject,
            duration: Number(minutes),
            date: selectedDateString,
            status: "planned",
            sort_order: nextSortOrder,
            start_time: startTime || null,
        });

        if (error) {
            alert(error.message);
            return;
        }

        closePopup();
        loadSessions();
    }

    async function addExam() {
        if (!examName || !examDate) return;

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { error } = await supabase.from("exams").insert({
            user_id: user.id,
            name: examName,
            date: examDate,
            color: examColor,
        });

        if (error) {
            alert(error.message);
            return;
        }

        closePopup();
        loadExams();
    }

    async function updateSession() {
        if (!selectedSession || !subject || !minutes) return;

        const { error } = await supabase
            .from("study_sessions")
            .update({
                subject,
                duration: Number(minutes),
                start_time: startTime || null,
            })
            .eq("id", selectedSession.id);

        if (error) {
            alert(error.message);
            return;
        }

        closePopup();
        loadSessions();
    }

    async function updateExam() {
        if (!selectedExam || !examName || !examDate) return;

        const { error } = await supabase
            .from("exams")
            .update({
                name: examName,
                date: examDate,
                color: examColor,
            })
            .eq("id", selectedExam.id);

        if (error) {
            alert(error.message);
            return;
        }

        closePopup();
        loadExams();
    }

    async function deleteSession() {
        if (!selectedSession) return;

        const confirmDelete = window.confirm("Vill du ta bort detta studiepass?");
        if (!confirmDelete) return;

        const { error } = await supabase
            .from("study_sessions")
            .delete()
            .eq("id", selectedSession.id);

        if (error) {
            alert(error.message);
            return;
        }

        closePopup();
        loadSessions();
    }

    async function deleteExam() {
        if (!selectedExam) return;

        const confirmDelete = window.confirm("Vill du ta bort detta prov?");
        if (!confirmDelete) return;

        const { error } = await supabase
            .from("exams")
            .delete()
            .eq("id", selectedExam.id);

        if (error) {
            alert(error.message);
            return;
        }

        closePopup();
        loadExams();
    }

    async function moveSessionToDate(session: StudySession, newDate: Date) {
        const newDateString = formatDate(newDate);

        if (session.date === newDateString) return;

        const confirmed = window.confirm(
            `Vill du flytta "${session.subject}" till ${newDate.getDate()}/${newDate.getMonth() + 1}?`
        );

        if (!confirmed) return;

        const { error } = await supabase
            .from("study_sessions")
            .update({ date: newDateString })
            .eq("id", session.id);

        if (error) {
            alert(error.message);
            return;
        }

        loadSessions();
    }

    async function startOrContinueSession(session: StudySession) {
        if (!isToday(session.date)) {
            alert("Du kan bara påbörja studiepass som ligger idag.");
            return;
        }

        const { error: pauseError } = await supabase
            .from("study_sessions")
            .update({ status: "paused" })
            .eq("status", "active")
            .neq("id", session.id);

        if (pauseError) {
            alert(pauseError.message);
            return;
        }

        const { error: startError } = await supabase
            .from("study_sessions")
            .update({ status: "active" })
            .eq("id", session.id);

        if (startError) {
            alert(startError.message);
            return;
        }

        window.location.href = `/pass/${session.id}?mode=study`;
    }

    async function reorderSession() {
        if (!draggedSession || !dragTargetSession) return;
        if (draggedSession.id === dragTargetSession.id) return;
        if (draggedSession.date !== dragTargetSession.date) return;

        const sameDaySessions = sessions
            .filter(
                (session) =>
                    session.date === dragTargetSession.date &&
                    session.status !== "done"
            )
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        const draggedIndex = sameDaySessions.findIndex(
            (session) => session.id === draggedSession.id
        );

        const targetIndex = sameDaySessions.findIndex(
            (session) => session.id === dragTargetSession.id
        );

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newOrder = [...sameDaySessions];
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, removed);

        await Promise.all(
            newOrder.map((session, index) =>
                supabase
                    .from("study_sessions")
                    .update({ sort_order: index })
                    .eq("id", session.id)
            )
        );

        setDragOverSessionId(null);
        setDragPreviewDate(null);
        setDragTargetSession(null);
        loadSessions();
    }

    function getBlockColor(session: StudySession) {
        const today = new Date();
        const todayString = formatDate(today);

        const isPast = session.date < todayString;

        if (session.status === "done") return "#16a34a";
        if (session.status === "active" || session.status === "paused") return "#ca8a04";
        if (isPast) return "#dc2626";

        return "#2563eb";
    }

    function formatStudyTime(totalMinutes: number) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0 && minutes > 0) {
            return `${hours} h ${minutes} min`;
        }

        if (hours > 0) {
            return `${hours} h`;
        }

        return `${minutes} min`;
    }

    function calculateEndTime(start: string, duration: number) {
        if (!start) return null;

        const [hours, minutes] = start.split(":").map(Number);

        const totalMinutes = hours * 60 + minutes + duration;

        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;

        return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
    }

    function daysUntilExam(dateString: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const examDateValue = new Date(dateString);
        examDateValue.setHours(0, 0, 0, 0);

        return Math.ceil((examDateValue.getTime() - today.getTime()) / 86400000);
    }

    function formatDaysUntilExam(dateString: string) {
        const daysLeft = daysUntilExam(dateString);

        if (daysLeft === 0) return "idag";
        if (daysLeft === 1) return "1 dag kvar";
        if (daysLeft > 1) return `${daysLeft} dagar kvar`;
        if (daysLeft === -1) return "1 dag sedan";

        return `${Math.abs(daysLeft)} dagar sedan`;
    }

    function formatExamDate(dateString: string) {
        const [year, month, day] = dateString.split("-");
        return `${day}/${month}/${year}`;
    }

    function buttonStyle(primary = false) {
        return {
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: primary ? "#2563eb" : "#e5e7eb",
            color: primary ? "white" : "#111",
        };
    }

    function optionButtonStyle(danger = false) {
        return {
            padding: "14px",
            borderRadius: "12px",
            border: danger ? "none" : "1px solid #cbd5e1",
            cursor: "pointer",
            fontWeight: "bold",
            background: danger ? "#ef4444" : "#f8fafc",
            color: danger ? "white" : "#111827",
            textAlign: "center" as const,
        };
    }


    function isBeforeToday(dateString: string) {
        const today = new Date();
        const todayString = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0"),
        ].join("-");

        return dateString < todayString;
    }

    function isToday(dateString: string) {
        return dateString === formatDate(new Date());
    }

    const upcomingExams = [...exams]
        .filter((exam) => !isBeforeToday(exam.date))
        .sort((a, b) => a.date.localeCompare(b.date));
    const popupOpen = selectedDate || selectedSession || selectedExam;

    const doneSessionsThisWeek = sessions.filter(
        (session) => session.status === "done"
    );

    const studiedMinutesThisWeek = doneSessionsThisWeek.reduce(
        (sum, session) => sum + session.duration,
        0
    );

    const weeklyGoalPercent =
        weeklyGoalMinutes === 0
            ? 0
            : Math.min(100, Math.round((studiedMinutesThisWeek / weeklyGoalMinutes) * 100));

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "32px",
                paddingBottom: "380px",
                fontFamily: "Arial, sans-serif",
                background:
                    "linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%)",
                boxShadow: "inset 0 0 200px rgba(37, 99, 235, 0.1)",
                color: "#e2e8f0",
            }}
        >
            <NavBar />

            <h1 style={{ fontSize: "36px", marginBottom: "4px" }}>📅 Studiekalender</h1>
            <p style={{ marginTop: 0, color: "#94a3b8" }}>
                Planera, flytta och genomför dina studiepass vecka för vecka.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "20px 0" }}>
                <button
                    onClick={() => setWeekOffset(weekOffset - 1)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        switchWeekWhileDragging("previous");
                    }}
                    onDragLeave={cancelWeekSwitch}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#e2e8f0",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                    }}
                >
                    ← Föregående
                </button>

                <strong>Vecka {weekNumber}</strong>

                <button
                    onClick={() => setWeekOffset(weekOffset + 1)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        switchWeekWhileDragging("next");
                    }}
                    onDragLeave={cancelWeekSwitch}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#e2e8f0",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                    }}
                >
                    Nästa →
                </button>
            </div>

            <section
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: "10px",
                }}
            >
                {days.map((day, index) => {
                    const date = new Date(startOfWeek);
                    date.setDate(startOfWeek.getDate() + index);
                    const dateString = formatDate(date);
                    const daySessions = sessions
                        .filter((session) => session.date === dateString)
                        .sort((a, b) => {
                            if (a.status === "done" && b.status !== "done") return 1;
                            if (a.status !== "done" && b.status === "done") return -1;
                            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                        });

                    const dayExams = exams
                        .filter((exam) => exam.date === dateString)
                        .sort((a, b) => a.name.localeCompare(b.name));

                    const studiedMinutesToday = daySessions
                        .filter((session) => session.status === "done")
                        .reduce((sum, session) => sum + session.duration, 0);

                    let previewSessions = daySessions;

                    if (
                        draggedSession &&
                        dragOverSessionId &&
                        dragPreviewDate === dateString &&
                        draggedSession.date === dateString
                    ) {
                        const draggedIndex = daySessions.findIndex(
                            (session) => session.id === draggedSession.id
                        );

                        const targetIndex = daySessions.findIndex(
                            (session) => session.id === dragOverSessionId
                        );

                        if (draggedIndex !== -1 && targetIndex !== -1) {
                            previewSessions = [...daySessions];
                            const [removed] = previewSessions.splice(draggedIndex, 1);
                            previewSessions.splice(targetIndex, 0, removed);
                        }
                    }

                    return (
                        <div key={day}>
                            <div
                                onClick={() => openAddPopup(date)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                    if (draggedSession) {
                                        moveSessionToDate(draggedSession, date);
                                        setDraggedSession(null);
                                    }
                                }}
                                style={{
                                    border: "1px solid rgba(148, 163, 184, 0.35)",
                                    borderRadius: "10px",
                                    padding: "10px",
                                    minHeight: "180px",
                                    overflowY: "auto",
                                    cursor: "pointer",
                                    background: "rgba(15, 23, 42, 0.6)",
                                    color: "#e2e8f0",
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
                                    backdropFilter: "blur(6px)",
                                }}
                            >
                                <strong>{day}</strong>
                                <br />
                                <span>{date.getDate()}/{date.getMonth() + 1}</span>

                                <div style={{ marginTop: "12px" }}>
                                    {dayExams.map((exam) => (
                                        <div
                                            key={exam.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openExamPopup(exam);
                                            }}
                                            style={{
                                                background: exam.color,
                                                color: "#ffffff",
                                                padding: "10px",
                                                borderRadius: "10px",
                                                marginBottom: "8px",
                                                fontWeight: "800",
                                                cursor: "pointer",
                                                textAlign: "center",
                                                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                                                boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
                                                border: "1px solid rgba(255,255,255,0.22)",
                                            }}
                                        >
                                            📝 {exam.name} – {formatDaysUntilExam(exam.date)}
                                        </div>
                                    ))}

                                    {previewSessions.map((session) => (
                                        <div
                                            key={session.id}
                                            draggable={session.status !== "done"}
                                            onDragStart={(e) => {
                                                e.stopPropagation();
                                                isDragging.current = true;
                                                setDraggedSession(session);
                                            }}
                                            onDragEnd={() => {
                                                setTimeout(() => {
                                                    isDragging.current = false;
                                                    setDraggedSession(null);
                                                    setDragOverSessionId(null);
                                                    setDragPreviewDate(null);
                                                    setDragTargetSession(null);
                                                    cancelWeekSwitch();
                                                }, 50);
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();

                                                if (
                                                    draggedSession &&
                                                    draggedSession.id !== session.id &&
                                                    draggedSession.date === session.date &&
                                                    session.status !== "done"
                                                ) {
                                                    setDragOverSessionId(session.id);
                                                    setDragPreviewDate(session.date);
                                                    setDragTargetSession(session);
                                                }
                                            }}
                                            onDrop={(e) => {
                                                e.stopPropagation();
                                                if (session.status !== "done") {
                                                    reorderSession();
                                                }
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isDragging.current) return;
                                                openEditPopup(session);
                                            }}
                                            style={{
                                                background: getBlockColor(session),
                                                opacity: draggedSession?.id === session.id ? 0.45 : 1,
                                                color: "#ffffff",
                                                padding: "10px",
                                                borderRadius: "10px",
                                                marginBottom: "8px",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                textAlign: "center",
                                                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                                                boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
                                                transform:
                                                    dragOverSessionId === session.id
                                                        ? "translateY(8px)"
                                                        : "translateY(0)",
                                                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                                            }}
                                        >
                                            <div>
                                                {session.subject} – {session.duration} min

                                                {session.start_time && session.status !== "done" && (
                                                    <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "3px" }}>
                                                        {session.start_time}–{calculateEndTime(session.start_time, session.duration)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {studiedMinutesToday > 0 && (
                                <div
                                    style={{
                                        marginTop: "8px",
                                        padding: "8px",
                                        borderRadius: "10px",
                                        background: "rgba(22, 163, 74, 0.15)",
                                        border: "1px solid rgba(22, 163, 74, 0.35)",
                                        color: "#bbf7d0",
                                        fontWeight: "bold",
                                        textAlign: "center",
                                        fontSize: "13px",
                                    }}
                                >
                                    Studerat: {formatStudyTime(studiedMinutesToday)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>
            <div
                style={{
                    position: "fixed",
                    right: "24px",
                    bottom: "20px",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "16px",
                    zIndex: 20,
                }}
            >
                <section
                    style={{
                        width: "320px",
                        padding: "18px",
                        borderRadius: "20px",
                        background: "rgba(15, 23, 42, 0.92)",
                        border: "1px solid rgba(148, 163, 184, 0.28)",
                        boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
                        backdropFilter: "blur(12px)",
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: "20px" }}>🎯 Veckomål</h2>

                    <p style={{ margin: "6px 0 14px", color: "#94a3b8", fontSize: "13px" }}>
                        Hur många timmar vill du plugga denna vecka?
                    </p>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <input
                            placeholder="Timmar"
                            type="number"
                            value={goalHours}
                            onChange={(e) => setGoalHours(e.target.value)}
                            style={{
                                width: "90px",
                                padding: "12px",
                                borderRadius: "12px",
                                border: "1px solid rgba(148, 163, 184, 0.35)",
                                background: "rgba(2, 6, 23, 0.75)",
                                color: "white",
                                outline: "none",
                            }}
                        />

                        <button
                            onClick={saveWeeklyGoal}
                            style={{
                                padding: "12px 14px",
                                borderRadius: "12px",
                                border: "none",
                                background: "#2563eb",
                                color: "white",
                                fontWeight: "bold",
                                cursor: "pointer",
                            }}
                        >
                            Spara
                        </button>
                    </div>

                    {weeklyGoalMinutes > 0 && (
                        <div style={{ marginTop: "14px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    marginBottom: "6px",
                                    fontSize: "14px",
                                    fontWeight: "bold",
                                }}
                            >
                                <span>{formatStudyTime(studiedMinutesThisWeek)}</span>
                                <span>{formatStudyTime(weeklyGoalMinutes)}</span>
                            </div>

                            <div
                                style={{
                                    height: "14px",
                                    borderRadius: "999px",
                                    background: "rgba(148, 163, 184, 0.22)",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${weeklyGoalPercent}%`,
                                        borderRadius: "999px",
                                        background: "#2563eb",
                                        transition: "width 0.3s ease",
                                    }}
                                />
                            </div>

                            <p style={{ color: "#94a3b8", margin: "8px 0 0", fontSize: "13px" }}>
                                {weeklyGoalPercent}% av veckomålet
                            </p>
                        </div>
                    )}
                </section>
                <aside
                    style={{
                        width: "330px",
                        maxHeight: "48vh",
                        overflowY: "auto",
                        background: "rgba(15, 23, 42, 0.92)",
                        border: "1px solid rgba(148, 163, 184, 0.28)",
                        borderRadius: "20px",
                        padding: "18px",
                        boxShadow: "0 25px 60px rgba(0,0,0,0.45)",
                        backdropFilter: "blur(12px)",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "20px" }}>📝 Prov</h2>
                            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "13px" }}>
                                Kommande prov
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                const today = new Date();
                                setSelectedDate(today);
                                setSelectedSession(null);
                                setSelectedExam(null);
                                setPopupMode("exam");
                                setExamName("");
                                setExamDate(formatDate(today));
                                setExamColor(examColors[0].value);
                                setIsEditingExam(true);
                            }}
                            style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "12px",
                                border: "none",
                                background: "#2563eb",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: "bold",
                                fontSize: "22px",
                                lineHeight: "38px",
                            }}
                            title="Lägg till prov"
                        >
                            +
                        </button>
                    </div>

                    <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {upcomingExams.length === 0 ? (
                            <p style={{ color: "#94a3b8", margin: 0, fontSize: "14px" }}>
                                Inga prov inlagda ännu.
                            </p>
                        ) : (
                            upcomingExams.map((exam) => (
                                <button
                                    key={exam.id}
                                    onClick={() => openExamPopup(exam)}
                                    style={{
                                        background: exam.color,
                                        color: "#ffffff",
                                        border: "1px solid rgba(255,255,255,0.22)",
                                        borderRadius: "14px",
                                        padding: "12px",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        boxShadow: "0 10px 22px rgba(0,0,0,0.3)",
                                    }}
                                >
                                    <div style={{ fontWeight: "800", fontSize: "15px" }}>
                                        {exam.name} – {formatDaysUntilExam(exam.date)}
                                    </div>
                                    <div style={{ opacity: 0.72, marginTop: "4px", fontSize: "13px", fontWeight: "bold" }}>
                                        {formatExamDate(exam.date)}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </aside>
            </div>

            {popupOpen && (
                <div
                    onClick={closePopup}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 50,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#ffffff",
                            color: "#111",
                            padding: "24px",
                            borderRadius: "16px",
                            width: "340px",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            border: "1px solid rgba(15, 23, 42, 0.08)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{ margin: 0 }}>
                                {selectedSession
                                    ? `${selectedSession.subject} – ${selectedSession.duration} min`
                                    : selectedExam
                                        ? `${selectedExam.name}`
                                        : popupMode === "exam"
                                            ? "Lägg till prov"
                                            : popupMode === "session"
                                                ? "Lägg till studiepass"
                                                : "Vad vill du lägga till?"}
                            </h2>
                            <button onClick={closePopup}>✕</button>
                        </div>

                        {selectedDate && !selectedSession && !selectedExam && !popupMode && (
                            <>
                                <p style={{ margin: 0 }}>
                                    Datum: {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                                </p>

                                <button
                                    onClick={() => {
                                        setPopupMode("session");
                                        setIsEditingSession(true);
                                    }}
                                    style={optionButtonStyle()}
                                >
                                    Lägg till studiepass
                                </button>

                                <button
                                    onClick={() => {
                                        setPopupMode("exam");
                                        setIsEditingExam(true);
                                        setExamDate(formatDate(selectedDate));
                                    }}
                                    style={optionButtonStyle()}
                                >
                                    Lägg till prov
                                </button>
                            </>
                        )}

                        {popupMode === "session" && (
                            <>
                                <p style={{ margin: 0 }}>
                                    {selectedSession
                                        ? `Datum: ${selectedSession.date}`
                                        : selectedDate &&
                                        `Datum: ${selectedDate.getDate()}/${selectedDate.getMonth() + 1}`}
                                </p>

                                {isEditingSession && (!selectedSession || selectedSession.status !== "done") && (
                                    <>
                                        <input
                                            placeholder="Ämne"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                                        />

                                        <input
                                            placeholder="Minuter"
                                            value={minutes}
                                            onChange={(e) => setMinutes(e.target.value)}
                                            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                                        />

                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                                        />
                                    </>
                                )}

                                {selectedSession ? (
                                    <>
                                        {isEditingSession ? (
                                            <button
                                                onClick={updateSession}
                                                style={optionButtonStyle()}
                                            >
                                                Spara ändringar
                                            </button>
                                        ) : (
                                            <>
                                                {selectedSession.status === "planned" && (
                                                    <>
                                                        <button
                                                            onClick={() => setIsEditingSession(true)}
                                                            style={optionButtonStyle()}
                                                        >
                                                            Redigera studiepass
                                                        </button>

                                                        {isToday(selectedSession.date) && (
                                                            <button
                                                                onClick={() => startOrContinueSession(selectedSession)}
                                                                style={optionButtonStyle()}
                                                            >
                                                                Påbörja studiepass
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() =>
                                                                (window.location.href = `/pass/${selectedSession.id}?mode=edit`)
                                                            }
                                                            style={optionButtonStyle()}
                                                        >
                                                            Redigera planering
                                                        </button>
                                                    </>
                                                )}

                                                {selectedSession.status === "active" && (
                                                    <>
                                                        <button
                                                            onClick={() => startOrContinueSession(selectedSession)}
                                                            style={optionButtonStyle()}
                                                        >
                                                            Fortsätt studiepass
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                (window.location.href = `/pass/${selectedSession.id}?mode=edit`)
                                                            }
                                                            style={optionButtonStyle()}
                                                        >
                                                            Redigera planering
                                                        </button>
                                                    </>
                                                )}

                                                {selectedSession.status === "paused" && (
                                                    <>
                                                        {isToday(selectedSession.date) && (
                                                            <button
                                                                onClick={() => startOrContinueSession(selectedSession)}
                                                                style={optionButtonStyle()}
                                                            >
                                                                Fortsätt studiepass
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() =>
                                                                (window.location.href = `/pass/${selectedSession.id}?mode=edit`)
                                                            }
                                                            style={optionButtonStyle()}
                                                        >
                                                            Redigera planering
                                                        </button>
                                                    </>
                                                )}

                                                {(selectedSession.status === "missed" || selectedSession.status === "done") && (
                                                    <button
                                                        onClick={() =>
                                                            (window.location.href = `/pass/${selectedSession.id}?mode=view`)
                                                        }
                                                        style={optionButtonStyle()}
                                                    >
                                                        Se planering
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        <button
                                            onClick={deleteSession}
                                            style={optionButtonStyle(true)}
                                        >
                                            Ta bort
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={addSession}
                                        style={buttonStyle(true)}
                                    >
                                        Lägg till
                                    </button>
                                )}
                            </>
                        )}



                        {popupMode === "exam" && (
                            <>
                                {(isEditingExam || !selectedExam) ? (
                                    <>
                                        <input
                                            placeholder="Provnamn"
                                            value={examName}
                                            onChange={(e) => setExamName(e.target.value)}
                                            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                                        />

                                        <input
                                            type="date"
                                            value={examDate}
                                            onChange={(e) => setExamDate(e.target.value)}
                                            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}
                                        />

                                        <div>
                                            <p style={{ margin: "0 0 8px", fontWeight: "bold" }}>Färg</p>
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px" }}>
                                                {examColors.map((color) => (
                                                    <button
                                                        key={color.value}
                                                        onClick={() => setExamColor(color.value)}
                                                        title={color.name}
                                                        style={{
                                                            height: "34px",
                                                            borderRadius: "999px",
                                                            border: examColor === color.value ? "3px solid #111827" : "2px solid #e5e7eb",
                                                            background: color.value,
                                                            cursor: "pointer",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            onClick={selectedExam ? updateExam : addExam}
                                            style={buttonStyle(true)}
                                        >
                                            {selectedExam ? "Spara ändringar" : "Lägg till prov"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            style={{
                                                background: selectedExam.color,
                                                color: "white",
                                                padding: "14px",
                                                borderRadius: "14px",
                                                fontWeight: "bold",
                                                boxShadow: "0 10px 22px rgba(0,0,0,0.22)",
                                            }}
                                        >
                                            <div>{selectedExam.name} – {formatDaysUntilExam(selectedExam.date)}</div>
                                            <div style={{ opacity: 0.75, marginTop: "4px", fontSize: "13px" }}>
                                                {formatExamDate(selectedExam.date)}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setIsEditingExam(true)}
                                            style={optionButtonStyle()}
                                        >
                                            Redigera prov
                                        </button>

                                        <button
                                            onClick={deleteExam}
                                            style={optionButtonStyle(true)}
                                        >
                                            Ta bort prov
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
