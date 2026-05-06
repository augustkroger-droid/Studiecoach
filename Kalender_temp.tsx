"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

const days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];


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

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);

    const [subject, setSubject] = useState("");
    const [minutes, setMinutes] = useState("");
    const [startTime, setStartTime] = useState("");
    const [isEditingSession, setIsEditingSession] = useState(false);

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
    }, [weekOffset]);

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

    function openAddPopup(date: Date) {
        setSelectedSession(null);
        setSelectedDate(date);
        setSubject("");
        setMinutes("");
        setStartTime("");
        setIsEditingSession(true);
    }

    function openEditPopup(session: StudySession) {
        setSelectedDate(null);
        setSelectedSession(session);
        setSubject(session.subject);
        setMinutes(String(session.duration));
        setStartTime(session.start_time || "");

        setIsEditingSession(false);
    }

    function closePopup() {
        setSelectedDate(null);
        setSelectedSession(null);
        setSubject("");
        setMinutes("");
        setStartTime("");
        setIsEditingSession(false);
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

        // DONE → grön
        if (session.status === "done") return "#16a34a";

        // ACTIVE → gul
        if (session.status === "active" || session.status === "paused") return "#ca8a04";

        // OM DET ÄR I DÅTIDEN
        if (isPast) {
            // inte gjort → röd
            return "#dc2626";
        }

        // annars (framtid/nutid, ej startad) → blå
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

    function NavItem({
        href,
        label,
        active = false,
    }: {
        href: string;
        label: string;
        active?: boolean;
    }) {
        return (
            <Link
                href={href}
                style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontWeight: "bold",
                    color: active ? "white" : "#cbd5f5",
                    background: active ? "#2563eb" : "transparent",
                    transition: "0.2s",
                }}
            >
                {label}
            </Link>
        );
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

    const popupOpen = selectedDate || selectedSession;

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "32px",
                fontFamily: "Arial, sans-serif",
                background:
                    "linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%)",
                boxShadow: "inset 0 0 200px rgba(37, 99, 235, 0.1)",
                color: "#e2e8f0",
            }}
        >
            <NavBar />

            <h1 style={{ fontSize: "36px", marginBottom: "4px" }}>📅 Studiekalender</h1>
            <p style={{ marginTop: 0, color: "#475569" }}>
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
                                    border: "1px solid #ccc",
                                    borderRadius: "10px",
                                    padding: "10px",
                                    minHeight: "180px",
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

            {
                popupOpen && (
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
                                width: "320px",
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
                                        : "Lägg till studiepass"}
                                </h2>
                                <button onClick={closePopup}>✕</button>
                            </div>

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

                            {/* KNAPPAR */}
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
                                            {/* PLANNED (blå) */}
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

                                            {/* ACTIVE (gul) */}
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

                                            {/* PAUSED (gul) */}
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

                                            {/* MISSED (röd) */}
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

                                    {/* DELETE (alla utom null) */}
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
                        </div>
                    </div>
                )
            }
        </main >

    );
}