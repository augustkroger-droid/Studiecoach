"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

type Priority = "Låg" | "Medel" | "Hög";
type BlockType = "understand" | "practice" | "quiz" | "repeat";

type ChecklistItem = {
    id: string;
    text: string;
    done: boolean;
};

type ResourceItem = {
    id: string;
    type: "link" | "file" | "image";
    title: string;
    url?: string;
    filePath?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
};

type StudyBlock = {
    id: string;
    type: BlockType;
    title: string;
    subtitle: string;
    checklist: ChecklistItem[];
    note: string;
};

type SelfTestQuestion = {
    id: string;
    question: string;
    answer: string;
    showAnswer: boolean;
};

type EndReview = {
    rating: number;
    wentWell: string;
    difficult: string;
    nextFocus: string;
};

type PlanningData = {
    goal: string;
    priority: Priority;
    blocks: StudyBlock[];
    resources: ResourceItem[];
    questions: SelfTestQuestion[];
    routine: string;
    selfNote: string;
    endReview: EndReview;
};

const STORAGE_BUCKET = "study-session-files";

const DEFAULT_BLOCKS: Omit<StudyBlock, "id" | "checklist" | "note">[] = [
    {
        type: "understand",
        title: "Förstå",
        subtitle: "Lägg in det du ska läsa, titta på eller förstå.",
    },
    {
        type: "practice",
        title: "Träna",
        subtitle: "Lägg in övningar, uppgifter eller saker du ska göra.",
    },
    {
        type: "quiz",
        title: "Testa dig själv",
        subtitle: "Lägg in frågor eller kontrollpunkter du ska kunna svara på.",
    },
    {
        type: "repeat",
        title: "Repetera",
        subtitle: "Lägg in sådant som ska repeteras eller göras om.",
    },
];

function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatBytes(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function defaultPlanningData(planningText = ""): PlanningData {
    return {
        goal: planningText || "",
        priority: "Medel",
        blocks: DEFAULT_BLOCKS.map((block) => ({
            ...block,
            id: uid(),
            checklist: [],
            note: "",
        })),
        resources: [],
        questions: [],
        routine: "",
        selfNote: "",
        endReview: {
            rating: 0,
            wentWell: "",
            difficult: "",
            nextFocus: "",
        },
    };
}

function normalizePlanningData(raw: any, planningText = ""): PlanningData {
    const fallback = defaultPlanningData(planningText);

    if (!raw || typeof raw !== "object") return fallback;

    return {
        ...fallback,
        ...raw,
        blocks: Array.isArray(raw.blocks) ? raw.blocks : fallback.blocks,
        resources: Array.isArray(raw.resources) ? raw.resources : [],
        questions: Array.isArray(raw.questions) ? raw.questions : [],
        routine: typeof raw.routine === "string" ? raw.routine : "",
        selfNote: typeof raw.selfNote === "string" ? raw.selfNote : "",
        endReview: {
            ...fallback.endReview,
            ...(raw.endReview || {}),
        },
    };
}

export default function PassPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();

    const mode = searchParams.get("mode") || "study";
    const isStudyMode = mode === "study";
    const isEditMode = mode === "edit";
    const isViewMode = mode === "view";
    const readOnly = isViewMode;

    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];

    const [subject, setSubject] = useState("");
    const [plannedMinutes, setPlannedMinutes] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [sessionStatus, setSessionStatus] = useState("");
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extraMinutes, setExtraMinutes] = useState(10);
    const [showPostPopup, setShowPostPopup] = useState(false);
    const [postComment, setPostComment] = useState("");
    const [postRating, setPostRating] = useState(0);
    const [finishedSession, setFinishedSession] = useState<any>(null);
    const [showTimerDoneAnimation, setShowTimerDoneAnimation] = useState(false);
    const [data, setData] = useState<PlanningData>(() => defaultPlanningData());
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const canEditTime = isEditMode && !["active", "paused", "done"].includes(sessionStatus);

    const secondsRef = useRef(0);
    const endTimeRef = useRef<number | null>(null);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedSecondRef = useRef<number | null>(null);

    const allChecklist = useMemo(
        () => data.blocks.flatMap((block) => block.checklist),
        [data.blocks]
    );

    const doneCount = allChecklist.filter((item) => item.done).length;
    const totalCount = allChecklist.length;
    const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;


    useEffect(() => {
        loadSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        secondsRef.current = secondsLeft;
    }, [secondsLeft]);

    useEffect(() => {
        alarmAudioRef.current = new Audio("/timer-finished.mp3");
    }, []);

    useEffect(() => {
        if (!id || !isRunning) return;

        const checkStatus = setInterval(async () => {
            const { data: sessionStatus, error } = await supabase
                .from("study_sessions")
                .select("status")
                .eq("id", id)
                .single();

            if (error || !sessionStatus) return;

            if (sessionStatus.status !== "active") {
                setIsRunning(false);
                alert("Detta studiepass pausades eftersom ett annat pass startades.");
                router.push("/kalender");
            }
        }, 2000);

        return () => clearInterval(checkStatus);
    }, [id, isRunning, router]);

    useEffect(() => {
        if (!isRunning || !id) return;

        if (!endTimeRef.current) {
            endTimeRef.current = Date.now() + secondsRef.current * 1000;
        }

        const interval = setInterval(async () => {
            const next = getCurrentRemainingSeconds();

            secondsRef.current = next;
            setSecondsLeft(next);

            if (
                lastSavedSecondRef.current === null ||
                Math.abs(lastSavedSecondRef.current - next) >= 15
            ) {
                lastSavedSecondRef.current = next;

                const { error } = await supabase
                    .from("study_sessions")
                    .update({ remaining_seconds: next })
                    .eq("id", id);

                if (error) console.error("Kunde inte spara tid:", error.message);
            }

            if (next <= 0) {
                clearInterval(interval);
                endTimeRef.current = null;
                setIsRunning(false);

                await supabase
                    .from("study_sessions")
                    .update({
                        remaining_seconds: 0,
                        status: "paused",
                        started_at: null,
                    })
                    .eq("id", id);

                alarmAudioRef.current?.play();
                triggerTimerDoneAnimation();

                setTimeout(() => {
                    openExtendModal();
                }, 1400);
            }
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning, id]);


    function scheduleSave(nextData: PlanningData) {
        setData(nextData);

        if (!id) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        saveTimerRef.current = setTimeout(() => {
            savePlanning(nextData);
        }, 500);
    }

    function triggerTimerDoneAnimation() {
        setShowTimerDoneAnimation(true);

        setTimeout(() => {
            setShowTimerDoneAnimation(false);
        }, 1800);
    }

    async function savePlanning(nextData = data) {
        if (!id) return;

        setSaving(true);

        const { error } = await supabase
            .from("study_sessions")
            .update({
                planning_data: nextData,
                planning: nextData.goal,
            })
            .eq("id", id);

        setSaving(false);
        if (error) alert(error.message);
    }

    async function loadSession() {
        const { data: session, error } = await supabase
            .from("study_sessions")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            alert(error.message);
            return;
        }

        const todayString = formatDate(new Date());

        if (isStudyMode && session.date !== todayString) {
            alert("Du kan bara starta studiepass som ligger idag.");
            router.push("/kalender");
            return;
        }

        const startSeconds =
            session.remaining_seconds !== null && session.remaining_seconds !== undefined
                ? session.remaining_seconds
                : session.duration * 60;

        const nextPlanningData = normalizePlanningData(session.planning_data, session.planning || "");

        setSubject(session.subject);
        setPlannedMinutes(session.duration);
        setSessionStatus(session.status || "");
        setSecondsLeft(startSeconds);
        secondsRef.current = startSeconds;
        setData(nextPlanningData);

        if (!isStudyMode) {
            setIsRunning(false);
            return;
        }

        await supabase
            .from("study_sessions")
            .update({ status: "paused" })
            .eq("status", "active")
            .neq("id", id);

        const endTime = getEndTimeFromSession(session.started_at, startSeconds);
        const adjustedStartSeconds = Math.max(
            Math.ceil((endTime - Date.now()) / 1000),
            0
        );

        setSecondsLeft(adjustedStartSeconds);
        secondsRef.current = adjustedStartSeconds;
        endTimeRef.current = Date.now() + adjustedStartSeconds * 1000;
        lastSavedSecondRef.current = adjustedStartSeconds;

        await supabase
            .from("study_sessions")
            .update({
                status: "active",
                remaining_seconds: adjustedStartSeconds,
                started_at: new Date().toISOString(),
            })
            .eq("id", id);

        setSessionStatus("active");

        setIsRunning(true);
    }

    function getCurrentRemainingSeconds() {
        if (!endTimeRef.current) return secondsRef.current;

        return Math.max(
            Math.ceil((endTimeRef.current - Date.now()) / 1000),
            0
        );
    }

    function getEndTimeFromSession(startedAt: string | null, remainingSeconds: number) {
        if (!startedAt) {
            return Date.now() + remainingSeconds * 1000;
        }

        const elapsedSeconds = Math.floor(
            (Date.now() - new Date(startedAt).getTime()) / 1000
        );

        const adjustedRemaining = Math.max(remainingSeconds - elapsedSeconds, 0);

        return Date.now() + adjustedRemaining * 1000;
    }

    function formatTime(seconds: number) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    const pauseSession = useCallback(async (updateUi = true) => {
        if (!id) return;

        const remaining = getCurrentRemainingSeconds();

        secondsRef.current = remaining;
        endTimeRef.current = null;
        lastSavedSecondRef.current = remaining;

        if (updateUi) {
            setSecondsLeft(remaining);
            setIsRunning(false);
            setSessionStatus("paused");
        }

        await supabase
            .from("study_sessions")
            .update({
                status: "paused",
                remaining_seconds: remaining,
                started_at: null,
            })
            .eq("id", id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        return () => {
            pauseSession(false);
        };
    }, [pauseSession]);

    useEffect(() => {
        if (!isStudyMode) return;

        async function handleInternalLinkClick(event: MouseEvent) {
            if (event.defaultPrevented) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const target = event.target as HTMLElement | null;
            const link = target?.closest("a") as HTMLAnchorElement | null;

            if (!link) return;
            if (link.target && link.target !== "_self") return;

            const href = link.getAttribute("href");
            if (!href || href.startsWith("#")) return;

            const url = new URL(href, window.location.href);

            const isSameWebsite = url.origin === window.location.origin;
            const isDifferentPage =
                url.pathname !== window.location.pathname ||
                url.search !== window.location.search;

            if (!isSameWebsite || !isDifferentPage) return;

            event.preventDefault();

            await pauseSession(false);

            router.push(url.pathname + url.search + url.hash);
        }

        document.addEventListener("click", handleInternalLinkClick, true);

        return () => {
            document.removeEventListener("click", handleInternalLinkClick, true);
        };
    }, [isStudyMode, router, pauseSession]);

    function openEndModal(actualMinutes: number) {
        setIsRunning(false);
        completeSession(actualMinutes);
    }

    async function completeSession(actualMinutes: number) {
        if (!id) return;

        const nextData = data;

        setData(nextData);
        setIsRunning(false);

        await supabase
            .from("study_sessions")
            .update({
                planning_data: nextData,
                planning: nextData.goal,
                status: "done",
                duration: actualMinutes,
                remaining_seconds: null,
                started_at: null,
            })
            .eq("id", id);

        setSessionStatus("done");

        const { data: sessionFromDb } = await supabase
            .from("study_sessions")
            .select("subject, date")
            .eq("id", id)
            .single();

        setFinishedSession({
            id,
            subject: sessionFromDb?.subject || nextData.goal || "Studiepass",
            duration: actualMinutes,
            date: sessionFromDb?.date || new Date().toISOString().split("T")[0],
        });

        setShowPostPopup(true);
    }

    async function togglePause() {
        if (isRunning) {
            await pauseSession(true);
        } else {
            endTimeRef.current = Date.now() + secondsRef.current * 1000;
            lastSavedSecondRef.current = secondsRef.current;

            setIsRunning(true);

            await supabase
                .from("study_sessions")
                .update({
                    status: "active",
                    remaining_seconds: secondsRef.current,
                    started_at: new Date().toISOString(),
                })
                .eq("id", id);

            setSessionStatus("active");
        }
    }

    async function stopEarly() {
        const remaining = getCurrentRemainingSeconds();
        const studiedSeconds = plannedMinutes * 60 - remaining;
        const actualMinutes = Math.max(1, Math.round(studiedSeconds / 60));

        secondsRef.current = remaining;
        setSecondsLeft(remaining);
        endTimeRef.current = null;

        await supabase
            .from("study_sessions")
            .update({
                status: "paused",
                remaining_seconds: secondsRef.current,
                started_at: null,
            })
            .eq("id", id);

        openEndModal(actualMinutes);
    }

    function updateGoal(goal: string) {
        scheduleSave({ ...data, goal });
    }

    function updatePriority(priority: Priority) {
        scheduleSave({ ...data, priority });
    }

    function toggleChecklist(blockId: string, itemId: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === blockId
                    ? {
                        ...block,
                        checklist: block.checklist.map((item) =>
                            item.id === itemId ? { ...item, done: !item.done } : item
                        ),
                    }
                    : block
            ),
        });
    }

    function updateChecklistText(blockId: string, itemId: string, text: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === blockId
                    ? {
                        ...block,
                        checklist: block.checklist.map((item) =>
                            item.id === itemId ? { ...item, text } : item
                        ),
                    }
                    : block
            ),
        });
    }

    function addChecklistItem(blockId: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === blockId
                    ? {
                        ...block,
                        checklist: [...block.checklist, { id: uid(), text: "", done: false }],
                    }
                    : block
            ),
        });
    }

    function removeBlock(blockId: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.filter((block) => block.id !== blockId),
        });
    }

    function getMissingBlocks() {
        return DEFAULT_BLOCKS.filter(
            (defaultBlock) =>
                !data.blocks.some((block) => block.type === defaultBlock.type)
        );
    }

    function addBlock(blockType: BlockType) {
        const defaultBlock = DEFAULT_BLOCKS.find((block) => block.type === blockType);
        if (!defaultBlock) return;

        const nextBlocks = [
            ...data.blocks,
            {
                ...defaultBlock,
                id: uid(),
                checklist: [],
                note: "",
            },
        ].sort(
            (a, b) =>
                DEFAULT_BLOCKS.findIndex((block) => block.type === a.type) -
                DEFAULT_BLOCKS.findIndex((block) => block.type === b.type)
        );

        scheduleSave({
            ...data,
            blocks: nextBlocks,
        });
    }

    function removeChecklistItem(blockId: string, itemId: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === blockId
                    ? {
                        ...block,
                        checklist: block.checklist.filter((item) => item.id !== itemId),
                    }
                    : block
            ),
        });
    }

    function updateBlockNote(blockId: string, note: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === blockId ? { ...block, note } : block
            ),
        });
    }

    function addLink() {
        const title = prompt("Titel på resursen?");
        if (!title) return;

        const url = prompt("Länk/URL?");
        if (!url) return;

        scheduleSave({
            ...data,
            resources: [...data.resources, { id: uid(), type: "link", title, url }],
        });
    }

    async function uploadResource(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file || !id) return;

        setUploading(true);

        const safeName = file.name.replace(/[^a-zA-Z0-9åäöÅÄÖ._-]/g, "_");
        const filePath = `${id}/${uid()}-${safeName}`;

        const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, { upsert: false });

        if (error) {
            setUploading(false);
            alert(error.message);
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

        const resource: ResourceItem = {
            id: uid(),
            type: file.type.startsWith("image/") ? "image" : "file",
            title: file.name,
            url: publicUrlData.publicUrl,
            filePath,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
        };

        setUploading(false);
        scheduleSave({ ...data, resources: [...data.resources, resource] });
        event.target.value = "";
    }

    function removeResource(resourceId: string) {
        scheduleSave({
            ...data,
            resources: data.resources.filter((resource) => resource.id !== resourceId),
        });
    }

    function addQuestion() {
        scheduleSave({
            ...data,
            questions: [
                ...data.questions,
                { id: uid(), question: "", answer: "", showAnswer: false },
            ],
        });
    }

    function updateQuestion(questionId: string, patch: Partial<SelfTestQuestion>) {
        scheduleSave({
            ...data,
            questions: data.questions.map((question) =>
                question.id === questionId ? { ...question, ...patch } : question
            ),
        });
    }

    function removeQuestion(questionId: string) {
        scheduleSave({
            ...data,
            questions: data.questions.filter((question) => question.id !== questionId),
        });
    }

    function updateRoutine(routine: string) {
        scheduleSave({ ...data, routine });
    }

    function updateSelfNote(selfNote: string) {
        scheduleSave({ ...data, selfNote });
    }

    function openExtendModal() {
        setIsRunning(false);
        endTimeRef.current = null;
        secondsRef.current = 0;
        setSecondsLeft(0);
        setExtraMinutes(10);
        setShowExtendModal(true);
    }

    async function extendSession() {
        if (!id) return;

        const addedSeconds = extraMinutes * 60;
        const newDuration = plannedMinutes + extraMinutes;

        setPlannedMinutes(newDuration);
        setSecondsLeft(addedSeconds);
        secondsRef.current = addedSeconds;
        endTimeRef.current = Date.now() + addedSeconds * 1000;
        lastSavedSecondRef.current = addedSeconds;

        setShowExtendModal(false);
        setIsRunning(true);
        setSessionStatus("active");

        await supabase
            .from("study_sessions")
            .update({
                duration: newDuration,
                remaining_seconds: addedSeconds,
                status: "active",
                started_at: new Date().toISOString(),
            })
            .eq("id", id);
    }

    function continueToEndReview() {
        setShowExtendModal(false);
        openEndModal(plannedMinutes);
    }

    async function postFinishedSession() {
        if (!finishedSession) return;

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { error } = await supabase.from("study_posts").insert({
            user_id: user.id,
            study_session_id: finishedSession.id,
            subject: finishedSession.subject,
            duration: finishedSession.duration,
            date: finishedSession.date,
            comment: postComment || null,
            rating: postRating || null,
        });

        if (error) {
            alert(error.message);
            return;
        }

        setShowPostPopup(false);
        setPostComment("");
        setPostRating(0);
        setFinishedSession(null);

        window.location.href = "/pepp";
    }

    function skipPosting() {
        setShowPostPopup(false);
        setPostComment("");
        setPostRating(0);
        setFinishedSession(null);

        window.location.href = "/kalender";
    }

    const inputStyle = {
        width: "100%",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        background: "rgba(15, 23, 42, 0.65)",
        color: "#e2e8f0",
        borderRadius: "10px",
        padding: "10px 12px",
        outline: "none",
        boxSizing: "border-box" as const,
    };

    const cardStyle = {
        background: "rgba(15, 23, 42, 0.72)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        borderRadius: "18px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
        boxSizing: "border-box" as const,
    };

    const smallButton = {
        border: "1px solid rgba(148, 163, 184, 0.25)",
        background: "rgba(255,255,255,0.06)",
        color: "#e2e8f0",
        borderRadius: "10px",
        padding: "8px 10px",
        cursor: "pointer",
        fontWeight: 700,
        whiteSpace: "nowrap" as const,
    };

    return (
        <main
            style={{
                minHeight: "100vh",
                overflowX: "auto",
                padding: "32px",
                fontFamily: "Arial, sans-serif",
                background: theme.background,
                color: theme.text,
            }}
        >
            <div className="pass-page-shell" style={{ minWidth: isStudyMode ? "1280px" : "1180px" }}>
                <NavBar />

                <ThemePicker
                    themeKey={themeKey}
                    setThemeKey={setThemeKey}
                    hidden={isStudyMode && isRunning}
                />

                {isStudyMode && (
                    <div
                        className="pass-timer-card"
                        style={{
                            position: "fixed",
                            top: "24px",
                            right: "32px",
                            background: "rgba(15, 23, 42, 0.92)",
                            padding: "18px",
                            borderRadius: "18px",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
                            width: "190px",
                            textAlign: "center",
                            zIndex: 10,
                            border: "1px solid rgba(148, 163, 184, 0.18)",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "42px",
                                fontWeight: "bold",
                                marginBottom: "14px",
                            }}
                        >
                            {formatTime(secondsLeft)}
                        </div>

                        <button
                            onClick={togglePause}
                            style={{ ...smallButton, width: "100%", marginBottom: "8px" }}
                        >
                            {isRunning ? "Pausa" : "Fortsätt"}
                        </button>

                        <button
                            onClick={stopEarly}
                            style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: "10px",
                                border: "none",
                                background: "rgba(239, 68, 68, 0.18)",
                                color: "#fecaca",
                                cursor: "pointer",
                                fontWeight: "bold",
                            }}
                        >
                            Avsluta tidigare
                        </button>
                    </div>
                )}

                <section
                    className="pass-title-section"
                    style={{
                        marginTop: "24px",
                        width: isStudyMode ? "1040px" : "1180px",
                    }}
                >
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "12px 16px",
                            borderRadius: "16px",
                            background: "rgba(15, 23, 42, 0.75)",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                        }}
                    >
                        <span style={{ fontSize: "24px" }}>📚</span>

                        <div>
                            {isEditMode ? (
                                <input
                                    value={subject}
                                    onChange={async (event) => {
                                        const value = event.target.value;

                                        setSubject(value);

                                        await supabase
                                            .from("study_sessions")
                                            .update({
                                                subject: value,
                                            })
                                            .eq("id", id);
                                    }}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        outline: "none",
                                        color: "#f8fafc",
                                        fontSize: "28px",
                                        fontWeight: "bold",
                                        width: "100%",
                                        padding: 0,
                                        margin: 0,
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        fontSize: "28px",
                                        fontWeight: "bold",
                                        color: "#f8fafc",
                                    }}
                                >
                                    {subject}
                                </div>
                            )}

                            <div
                                style={{
                                    fontSize: "14px",
                                    color: "#94a3b8",
                                    marginTop: "2px",
                                }}
                            >
                                Studiepass {isEditMode ? "· planering" : isViewMode ? "· översikt" : "· fokusläge"}
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="pass-main-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "760px 340px",
                        gap: "22px",
                        marginTop: "28px",
                        width: isStudyMode ? "1122px" : "1122px",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px", minWidth: 0 }}>
                        <div
                            className="pass-goal-time-card"
                            style={{
                                ...cardStyle,
                                padding: "18px",
                                display: "grid",
                                gridTemplateColumns: "1fr 140px",
                                gap: "18px",
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <h2 style={{ margin: 0, fontSize: "20px", color: "#f8fafc" }}>
                                    Vad ska jag lära mig?
                                </h2>

                                {readOnly ? (
                                    <p style={{ color: "#cbd5e1", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                                        {data.goal || "Ingen målbeskrivning inlagd."}
                                    </p>
                                ) : (
                                    <textarea
                                        value={data.goal}
                                        onChange={(event) => updateGoal(event.target.value)}
                                        rows={3}
                                        placeholder="Skriv vad du ska kunna efter passet..."
                                        style={{ ...inputStyle, marginTop: "10px", resize: "vertical" }}
                                    />
                                )}
                            </div>



                            <div>
                                <div style={{ color: "#94a3b8", marginBottom: "10px" }}>
                                    ⏱ Tid
                                </div>

                                {canEditTime ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <input
                                            type="number"
                                            min={1}
                                            value={plannedMinutes}
                                            onChange={async (event) => {
                                                const minutes = Number(event.target.value);

                                                setPlannedMinutes(minutes);

                                                const newSeconds = minutes * 60;
                                                setSecondsLeft(newSeconds);
                                                secondsRef.current = newSeconds;

                                                await supabase
                                                    .from("study_sessions")
                                                    .update({
                                                        duration: minutes,
                                                        remaining_seconds: newSeconds,
                                                    })
                                                    .eq("id", id);
                                            }}
                                            style={{
                                                border: "1px solid rgba(148, 163, 184, 0.25)",
                                                background: "rgba(15, 23, 42, 0.65)",
                                                color: "#e2e8f0",
                                                borderRadius: "10px",
                                                padding: "8px 10px",
                                                outline: "none",
                                                width: "90px",
                                                fontWeight: "bold",
                                                fontSize: "16px",
                                            }}
                                        />

                                        <span style={{ color: "#94a3b8" }}>min</span>
                                    </div>
                                ) : (
                                    <strong style={{ fontSize: "18px", color: "#f8fafc" }}>
                                        ⏱ {plannedMinutes} min
                                    </strong>
                                )}
                            </div>
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "14px",
                                }}
                            >
                                <h2 style={{ margin: 0, fontSize: "20px" }}>Plan – vad ska göras?</h2>
                                <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                                    {saving ? "Sparar..." : "Sparat automatiskt"}
                                </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                {data.blocks.map((block, index) => (
                                    <div
                                        key={block.id}
                                        style={{
                                            border: "1px solid rgba(148,163,184,.16)",
                                            borderRadius: "14px",
                                            padding: "16px",
                                            background: "rgba(30,41,59,.35)",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <h3 style={{ margin: 0, fontSize: "17px", color: "#f8fafc" }}>
                                                Steg {index + 1} – {block.title.replace(/^Steg \d+ – /, "")}
                                            </h3>

                                            {!readOnly && (
                                                <button
                                                    onClick={() => removeBlock(block.id)}
                                                    style={smallButton}
                                                >
                                                    Ta bort
                                                </button>
                                            )}
                                        </div>
                                        <p style={{ margin: "8px 0 14px", color: "#94a3b8" }}>{block.subtitle}</p>

                                        <div
                                            className="pass-block-inner-grid"
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 290px",
                                                gap: "18px",
                                                alignItems: "start",
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                {block.checklist.length === 0 && (
                                                    <div
                                                        style={{
                                                            color: "#94a3b8",
                                                            border: "1px dashed rgba(148,163,184,.25)",
                                                            borderRadius: "12px",
                                                            padding: "12px",
                                                            marginBottom: "12px",
                                                        }}
                                                    >
                                                        Inga checkrutor ännu.
                                                    </div>
                                                )}

                                                {block.checklist.map((item) => (
                                                    <label
                                                        key={item.id}
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns: readOnly ? "24px 1fr" : "24px 1fr 34px",
                                                            alignItems: "center",
                                                            gap: "10px",
                                                            marginBottom: "12px",
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={item.done}
                                                            disabled={isEditMode}
                                                            onChange={() => {
                                                                if (!isEditMode) {
                                                                    toggleChecklist(block.id, item.id);
                                                                }
                                                            }}
                                                        />

                                                        {isViewMode ? (
                                                            <span
                                                                style={{
                                                                    textDecoration: item.done ? "line-through" : "none",
                                                                    color: item.done ? "#94a3b8" : "#e2e8f0",
                                                                    wordBreak: "break-word",
                                                                }}
                                                            >
                                                                {item.text || "Namnlös checkruta"}
                                                            </span>
                                                        ) : (
                                                            <input
                                                                value={item.text}
                                                                onChange={(event) =>
                                                                    updateChecklistText(block.id, item.id, event.target.value)
                                                                }
                                                                placeholder="Skriv checkruta..."
                                                                style={{
                                                                    ...inputStyle,
                                                                    padding: "8px 10px",
                                                                    textDecoration: item.done ? "line-through" : "none",
                                                                    color: item.done ? "#94a3b8" : "#e2e8f0",
                                                                }}
                                                            />
                                                        )}
                                                    </label>
                                                ))}

                                                {!readOnly && (
                                                    <button
                                                        onClick={() => addChecklistItem(block.id)}
                                                        style={smallButton}
                                                        type="button"
                                                    >
                                                        + Lägg till checkruta
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "8px" }}>
                                                    {block.type === "quiz"
                                                        ? "Vad är det viktigaste jag ska kunna efter passet?"
                                                        : "Anteckningar"}
                                                </div>

                                                <textarea
                                                    disabled={readOnly}
                                                    value={block.note}
                                                    onChange={(event) => updateBlockNote(block.id, event.target.value)}
                                                    placeholder={
                                                        block.type === "quiz"
                                                            ? "Skriv vad eleven ska kunna testa sig själv på..."
                                                            : "Egna anteckningar för detta steg..."
                                                    }
                                                    rows={6}
                                                    style={{ ...inputStyle, resize: "vertical" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!readOnly && getMissingBlocks().length > 0 && (
                                    <div
                                        style={{
                                            marginTop: "16px",
                                            paddingTop: "16px",
                                            borderTop: "1px solid rgba(148,163,184,.16)",
                                        }}
                                    >
                                        <div style={{ color: "#94a3b8", marginBottom: "10px" }}>
                                            Lägg till borttaget steg
                                        </div>

                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                            {getMissingBlocks().map((block) => (
                                                <button
                                                    key={block.type}
                                                    onClick={() => addBlock(block.type)}
                                                    style={smallButton}
                                                    type="button"
                                                >
                                                    + {block.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "14px",
                                }}
                            >
                                <h2 style={{ margin: 0, fontSize: "20px" }}>Resurser</h2>

                                {!readOnly && (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button onClick={addLink} style={smallButton} type="button">
                                            + Lägg till länk
                                        </button>

                                        <label style={{ ...smallButton, display: "inline-block" }}>
                                            {uploading ? "Laddar upp..." : "+ Ladda upp fil/bild"}
                                            <input
                                                hidden
                                                type="file"
                                                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
                                                onChange={uploadResource}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div
                                className="pass-resource-grid"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                    gap: "12px",
                                }}
                            >
                                {data.resources.map((resource) => (
                                    <div
                                        key={resource.id}
                                        style={{
                                            border: "1px solid rgba(148,163,184,.16)",
                                            borderRadius: "12px",
                                            padding: "12px",
                                            background: "rgba(30,41,59,.35)",
                                            minWidth: 0,
                                        }}
                                    >
                                        <a
                                            href={resource.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                color: "#f8fafc",
                                                fontWeight: 700,
                                                textDecoration: "none",
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {resource.type === "image" ? "🖼️" : resource.type === "file" ? "📄" : "🔗"} {resource.title}
                                        </a>

                                        <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "6px" }}>
                                            {resource.mimeType || "Länk"} {formatBytes(resource.sizeBytes)}
                                        </div>

                                        {!readOnly && (
                                            <button
                                                onClick={() => removeResource(resource.id)}
                                                style={{ ...smallButton, marginTop: "10px" }}
                                                type="button"
                                            >
                                                Ta bort
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {data.resources.length === 0 && (
                                    <div style={{ color: "#94a3b8" }}>Inga resurser tillagda ännu.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <aside style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h3 style={{ marginTop: 0 }}>Framsteg</h3>

                            <div
                                style={{
                                    height: "10px",
                                    borderRadius: "999px",
                                    background: "rgba(148,163,184,.18)",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: `${progress}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg,#8b5cf6,#60a5fa)",
                                    }}
                                />
                            </div>

                            <p style={{ color: "#cbd5e1" }}>
                                {progress}% · Avklarat: {doneCount} av {totalCount} uppgifter
                            </p>
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h3 style={{ marginTop: 0 }}>Checklista snabbvy</h3>

                            {allChecklist.length === 0 && (
                                <p style={{ color: "#94a3b8" }}>Inga checkrutor inlagda ännu.</p>
                            )}

                            {allChecklist.slice(0, 8).map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        marginBottom: "10px",
                                        color: item.done ? "#86efac" : "#cbd5e1",
                                        overflowWrap: "anywhere",
                                    }}
                                >
                                    {item.done ? "✅" : "⬜"} {item.text || "Namnlös checkruta"}
                                </div>
                            ))}
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h2 style={{ marginBottom: 10, fontSize: "20px" }}>Fokus och egna anteckningar</h2>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr",
                                    gap: "12px",
                                }}
                            >
                                <div style={{ border: "1px solid rgba(148,163,184,.16)", borderRadius: "12px", padding: "14px" }}>
                                    <strong>Min pluggrutin</strong>
                                    <textarea
                                        disabled={isStudyMode || isViewMode}
                                        value={data.routine}
                                        onChange={(event) => updateRoutine(event.target.value)}
                                        rows={6}
                                        placeholder="Exempel: stäng av mobilen, ta fram boken, öppna anteckningar..."
                                        style={{ ...inputStyle, marginTop: "10px", resize: "vertical" }}
                                    />
                                </div>

                                <div style={{ border: "1px solid rgba(148,163,184,.16)", borderRadius: "12px", padding: "14px" }}>
                                    <strong>Anteckningar till mig själv</strong>
                                    <textarea
                                        disabled={readOnly}
                                        value={data.selfNote}
                                        onChange={(event) => updateSelfNote(event.target.value)}
                                        rows={6}
                                        placeholder="Frivilliga anteckningar inför passet..."
                                        style={{ ...inputStyle, marginTop: "10px", resize: "vertical" }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "10px",
                                }}
                            >
                                <h3 style={{ margin: 0 }}>Testa dig själv</h3>
                                {!readOnly && (
                                    <button onClick={addQuestion} style={smallButton} type="button">
                                        + Fråga
                                    </button>
                                )}
                            </div>

                            {data.questions.length === 0 && (
                                <p style={{ color: "#94a3b8" }}>Inga frågor inlagda ännu.</p>
                            )}

                            {data.questions.map((question) => (
                                <div
                                    key={question.id}
                                    style={{
                                        borderTop: "1px solid rgba(148,163,184,.14)",
                                        paddingTop: "12px",
                                        marginTop: "12px",
                                    }}
                                >
                                    {readOnly ? (
                                        <strong style={{ overflowWrap: "anywhere" }}>
                                            {question.question || "Namnlös fråga"}
                                        </strong>
                                    ) : (
                                        <input
                                            value={question.question}
                                            onChange={(event) =>
                                                updateQuestion(question.id, { question: event.target.value })
                                            }
                                            placeholder="Skriv fråga..."
                                            style={inputStyle}
                                        />
                                    )}

                                    {!readOnly && (
                                        <textarea
                                            value={question.answer}
                                            onChange={(event) =>
                                                updateQuestion(question.id, { answer: event.target.value })
                                            }
                                            placeholder="Skriv facit/svar..."
                                            rows={3}
                                            style={{ ...inputStyle, marginTop: "10px", resize: "vertical" }}
                                        />
                                    )}

                                    {readOnly && question.answer && (
                                        <button
                                            onClick={() =>
                                                updateQuestion(question.id, {
                                                    showAnswer: !question.showAnswer,
                                                })
                                            }
                                            style={{ ...smallButton, width: "100%", marginTop: "8px" }}
                                            type="button"
                                        >
                                            {question.showAnswer ? "Dölj svar" : "Visa svar"}
                                        </button>
                                    )}

                                    {readOnly && question.showAnswer && (
                                        <p style={{ color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{question.answer}</p>
                                    )}

                                    {!readOnly && (
                                        <button
                                            onClick={() => removeQuestion(question.id)}
                                            style={{ ...smallButton, marginTop: "8px" }}
                                            type="button"
                                        >
                                            Ta bort fråga
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </aside>
                </section>
            </div>
            {showTimerDoneAnimation && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 45,
                        pointerEvents: "none",
                        overflow: "hidden",
                    }}
                >
                    {/* Explosion mitten */}
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            animation: "studyBoom 0.9s ease-out forwards",
                            fontSize: "42px",
                            fontWeight: 900,
                            color: "#f8fafc",
                            textShadow: "0 0 30px rgba(255,255,255,0.4)",
                        }}
                    >
                        BRA JOBBAT 🚀
                    </div>

                    {Array.from({ length: 28 }).map((_, index) => {
                        const icons = ["📚", "✏️", "📝", "💡", "📖", "⭐", "🧠", "📐"];

                        const randomX = Math.random() * 1200 - 600;
                        const randomY = Math.random() * 900 - 450;
                        const randomRotate = Math.random() * 720 - 360;
                        const randomSize = 20 + Math.random() * 26;
                        const randomDuration = 1200 + Math.random() * 900;

                        return (
                            <span
                                key={index}
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    fontSize: `${randomSize}px`,
                                    animation: `studyExplosion ${randomDuration}ms cubic-bezier(.17,.89,.32,1.28) forwards`,
                                    transform: `translate(-50%, -50%)`,
                                    ["--x" as any]: `${randomX}px`,
                                    ["--y" as any]: `${randomY}px`,
                                    ["--r" as any]: `${randomRotate}deg`,
                                }}
                            >
                                {icons[index % icons.length]}
                            </span>
                        );
                    })}

                    <style jsx>{`
            @keyframes studyBoom {
                0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.2);
                }

                40% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1.2);
                }

                100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(1);
                }
            }

            @keyframes studyExplosion {
                0% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.3);
                }

                15% {
                    opacity: 1;
                }

                100% {
                    opacity: 0;
                    transform:
                        translate(
                            calc(-50% + var(--x)),
                            calc(-50% + var(--y))
                        )
                        rotate(var(--r))
                        scale(1.2);
                }
            }
        `}</style>
                </div>
            )}

            {showExtendModal && (
                <div
                    className="pass-modal-backdrop"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(2, 6, 23, 0.78)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 50,
                        padding: "24px",
                    }}
                >
                    <div
                        className="pass-modal-card"
                        style={{
                            width: "480px",
                            maxWidth: "calc(100vw - 48px)",
                            background: "#0f172a",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            borderRadius: "20px",
                            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                            padding: "22px",
                        }}
                    >
                        <h2 style={{ margin: 0, color: "#f8fafc" }}>
                            Bra jobbat! 🎉
                        </h2>

                        <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                            Du har nu jobbat i {plannedMinutes} minuter.
                            Det kan vara bra att ta en kort paus.
                        </p>

                        <label style={{ color: "#cbd5e1", display: "block", marginBottom: "8px" }}>
                            Vill du lägga till fler minuter?
                        </label>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                                type="number"
                                min={1}
                                value={extraMinutes}
                                onChange={(event) => setExtraMinutes(Number(event.target.value))}
                                style={{
                                    border: "1px solid rgba(148, 163, 184, 0.25)",
                                    background: "rgba(15, 23, 42, 0.65)",
                                    color: "#e2e8f0",
                                    borderRadius: "10px",
                                    padding: "8px 10px",
                                    outline: "none",
                                    width: "90px",
                                    fontWeight: "bold",
                                    fontSize: "16px",
                                }}
                            />

                            <span style={{ color: "#94a3b8" }}>min</span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "10px",
                                marginTop: "20px",
                            }}
                        >
                            <button
                                onClick={continueToEndReview}
                                style={smallButton}
                                type="button"
                            >
                                Avsluta passet
                            </button>

                            <button
                                onClick={extendSession}
                                style={{
                                    ...smallButton,
                                    background: "linear-gradient(90deg,#16a34a,#22c55e)",
                                    color: "white",
                                    border: "none",
                                    padding: "10px 16px",
                                }}
                                type="button"
                            >
                                Lägg till tid
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {showPostPopup && finishedSession && (
                <div
                    className="pass-modal-backdrop"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                    }}
                >
                    <div
                        className="pass-modal-card"
                        style={{
                            width: "360px",
                            background: "#0f172a",
                            color: "#e2e8f0",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            borderRadius: "18px",
                            padding: "24px",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        <h2 style={{ margin: 0 }}>Posta ditt studiepass?</h2>

                        <p style={{ margin: 0, color: "#475569" }}>
                            Detta kommer synas för dina vänner på Pepp-sidan.
                        </p>

                        <div
                            style={{
                                padding: "12px",
                                borderRadius: "12px",
                                background: "rgba(30, 41, 59, 0.85)",
                                fontWeight: "bold",
                            }}
                        >
                            {finishedSession.subject} – {finishedSession.duration} min
                        </div>
                        <div>
                            <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                                Hur kändes passet?
                            </div>

                            <div style={{ display: "flex", gap: "4px" }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setPostRating(star)}
                                        style={{
                                            background: "transparent",
                                            border: 0,
                                            cursor: "pointer",
                                            fontSize: "34px",
                                            padding: 0,
                                            lineHeight: 1,
                                        }}
                                        type="button"
                                    >
                                        <span
                                            style={{
                                                color: star <= postRating ? "#fbbf24" : "#cbd5e1",
                                                transition: "0.15s",
                                            }}
                                        >
                                            ★
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea
                            placeholder="Skriv en kommentar som dina vänner kan se..."
                            value={postComment}
                            onChange={(e) => setPostComment(e.target.value)}
                            style={{
                                minHeight: "90px",
                                padding: "12px",
                                borderRadius: "12px",
                                border: "1px solid rgba(148, 163, 184, 0.35)",
                                background: "rgba(2, 6, 23, 0.75)",
                                color: "#e2e8f0",
                                resize: "vertical",
                                fontFamily: "Arial, sans-serif",
                            }}
                        />

                        <button
                            onClick={postFinishedSession}
                            style={{
                                padding: "12px",
                                borderRadius: "12px",
                                border: "none",
                                background: "#2563eb",
                                color: "white",
                                fontWeight: "bold",
                                cursor: "pointer",
                            }}
                        >
                            Posta på Pepp
                        </button>

                        <button
                            onClick={skipPosting}
                            style={{
                                padding: "12px",
                                borderRadius: "12px",
                                border: "1px solid #cbd5e1",
                                background: "rgba(15, 23, 42, 0.75)",
                                color: "#e2e8f0",
                                fontWeight: "bold",
                                cursor: "pointer",
                            }}
                        >
                            Nej, gå tillbaka till kalendern
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
