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
    provider?: "youtube" | "quizlet" | "drive" | "link";
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
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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
        subtitle: "Lägg in Quizlet, övningsprov eller annat du ska träna på.",
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
    const [resourceTitle, setResourceTitle] = useState("");
    const [resourceUrl, setResourceUrl] = useState("");
    const [loadingLinkTitle, setLoadingLinkTitle] = useState(false);
    const [collapsedBlockIds, setCollapsedBlockIds] = useState<string[]>([]);
    const BREAK_INTERVAL_SECONDS = 30 * 60;

    const [activeStudySeconds, setActiveStudySeconds] = useState(0);
    const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);
    const BREAK_SECONDS = 5 * 60;

    const [showBreakModal, setShowBreakModal] = useState(false);
    const [breakSecondsLeft, setBreakSecondsLeft] = useState(BREAK_SECONDS);
    const [breakDone, setBreakDone] = useState(false);
    const [timerMinimized, setTimerMinimized] = useState(false);
    const [isMobileTimer, setIsMobileTimer] = useState(false);
    const [timerPosition, setTimerPosition] = useState<{ x: number; y: number } | null>(null);
    const [timerReady, setTimerReady] = useState(false);
    const [timerDragging, setTimerDragging] = useState(false);
    const timerCardRef = useRef<HTMLDivElement | null>(null);
    const timerDragOffsetRef = useRef({ x: 0, y: 0 });
    const timerLatestPositionRef = useRef({ x: 0, y: 100 });

    const canEditTime = isEditMode && !["active", "paused", "done"].includes(sessionStatus);

    const secondsRef = useRef(0);
    const endTimeRef = useRef<number | null>(null);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedSecondRef = useRef<number | null>(null);
    const isLeavingPageRef = useRef(false);
    const hasCompletedSessionRef = useRef(false);
    const originalTitleRef = useRef<string | null>(null);
    const tabAlertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const tabAlertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const allChecklist = useMemo(
        () => data.blocks.flatMap((block) => block.checklist),
        [data.blocks]
    );

    const doneCount = allChecklist.filter((item) => item.done).length;
    const totalCount = allChecklist.length;
    const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
    const nextTask = data.blocks
        .flatMap((block) =>
            block.checklist.map((item) => ({
                ...item,
                blockId: block.id,
                blockTitle: block.title,
            }))
        )
        .find((item) => !item.done);


    useEffect(() => {
        originalTitleRef.current = document.title;

        loadSession();

        return () => {
            if (originalTitleRef.current) {
                document.title = originalTitleRef.current;
            }
        };

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

                if (!isLeavingPageRef.current) {
                    alert("Detta studiepass pausades eftersom ett annat pass startades.");
                    router.push("/kalender");
                }
            }
        }, 2000);

        return () => clearInterval(checkStatus);
    }, [id, isRunning, router]);

    useEffect(() => {
        if (!showBreakModal || breakDone) return;

        const interval = setInterval(() => {
            setBreakSecondsLeft((current) => {
                if (current <= 1) {
                    clearInterval(interval);
                    setBreakDone(true);
                    return 0;
                }

                return current - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [showBreakModal, breakDone]);

    useEffect(() => {
        if (!timerDragging) return;

        function handleMouseMove(event: MouseEvent) {
            const nextPosition = {
                x: event.clientX - timerDragOffsetRef.current.x,
                y: event.clientY - timerDragOffsetRef.current.y,
            };

            timerLatestPositionRef.current = nextPosition;

            if (timerCardRef.current) {
                timerCardRef.current.style.transform =
                    `translate3d(${nextPosition.x}px, ${nextPosition.y}px, 0)`;
            }
        }

        function handleMouseUp() {
            setTimerPosition(timerLatestPositionRef.current);
            setTimerDragging(false);
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [timerDragging]);

    useEffect(() => {
        if (!isRunning || !id) return;

        if (!endTimeRef.current) {
            endTimeRef.current = Date.now() + secondsRef.current * 1000;
        }

        const interval = setInterval(async () => {
            const next = getCurrentRemainingSeconds();

            secondsRef.current = next;
            setSecondsLeft(next);
            setActiveStudySeconds((current) => {
                const updated = current + 1;

                if (updated > 0 && updated % BREAK_INTERVAL_SECONDS === 0) {
                    setShowBreakSuggestion(true);
                }

                return updated;
            });

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
                        paused_at: new Date().toISOString()
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
        startDoneTabAlert();

        setTimeout(() => {
            setShowTimerDoneAnimation(false);
        }, 1800);
    }

    function stopDoneTabAlert() {
        if (tabAlertIntervalRef.current !== null) {
            clearInterval(tabAlertIntervalRef.current);
            tabAlertIntervalRef.current = null;
        }

        if (tabAlertTimeoutRef.current !== null) {
            clearTimeout(tabAlertTimeoutRef.current);
            tabAlertTimeoutRef.current = null;
        }

        document.title = originalTitleRef.current || "Studiepass";
    }

    function startDoneTabAlert() {
        stopDoneTabAlert();

        const originalTitle = originalTitleRef.current || document.title;
        let visible = true;

        tabAlertIntervalRef.current = setInterval(() => {
            document.title = visible ? "🎉 Passet är klart!" : originalTitle;
            visible = !visible;
        }, 1000);

        tabAlertTimeoutRef.current = setTimeout(() => {
            if (tabAlertIntervalRef.current !== null) {
                clearInterval(tabAlertIntervalRef.current);
                tabAlertIntervalRef.current = null;
            }

            document.title = "🎉 Passet är klart!";
        }, 30000);
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
                paused_at: null,
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

    async function startSuggestedBreak() {
        setShowBreakSuggestion(false);
        setActiveStudySeconds(0);

        await pauseSession(true);

        setBreakSecondsLeft(BREAK_SECONDS);
        setBreakDone(false);
        setShowBreakModal(true);
    }

    async function finishSuggestedBreak() {
        setShowBreakModal(false);
        setBreakSecondsLeft(BREAK_SECONDS);
        setBreakDone(false);

        const remaining = secondsRef.current;

        endTimeRef.current = Date.now() + remaining * 1000;
        lastSavedSecondRef.current = remaining;

        const { error } = await supabase
            .from("study_sessions")
            .update({
                status: "active",
                remaining_seconds: remaining,
                started_at: new Date().toISOString(),
                paused_at: null,
            })
            .eq("id", id);

        if (error) {
            alert(error.message);
            return;
        }

        setIsRunning(true);
        setSessionStatus("active");
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

            if (sessionStatus !== "planned") {
                setSessionStatus("paused");
            }
        }

        const updateData: any = {
            remaining_seconds: remaining,
            started_at: null,
            paused_at: new Date().toISOString(),
        };

        if (sessionStatus !== "planned") {
            updateData.status = "paused";
        }

        await supabase
            .from("study_sessions")
            .update(updateData)
            .eq("id", id);
    }, [id, sessionStatus]);

    useEffect(() => {
        function pauseWithBeacon() {
            if (!id) return;
            if (!isStudyMode) return;
            if (!isRunning) return;
            if (hasCompletedSessionRef.current) return;
            if (isLeavingPageRef.current) return;

            const remaining = getCurrentRemainingSeconds();

            navigator.sendBeacon(
                "/api/pass/pause",
                JSON.stringify({
                    id,
                    remaining_seconds: remaining,
                    paused_at: new Date().toISOString(),
                })
            );
        }

        window.addEventListener("pagehide", pauseWithBeacon);

        return () => {
            window.removeEventListener("pagehide", pauseWithBeacon);

            if (hasCompletedSessionRef.current) return;

            if (isStudyMode && isRunning) {
                pauseSession(false);
            }
        };
    }, [id, isStudyMode, isRunning, pauseSession]);

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

            isLeavingPageRef.current = true;

            await pauseSession(false);

            router.push(url.pathname + url.search + url.hash);
        }

        document.addEventListener("click", handleInternalLinkClick, true);

        return () => {
            document.removeEventListener("click", handleInternalLinkClick, true);
        };
    }, [isStudyMode, router, pauseSession]);

    useEffect(() => {
        function checkMobileTimer() {
            setIsMobileTimer(window.innerWidth <= 768);
        }

        checkMobileTimer();
        window.addEventListener("resize", checkMobileTimer);

        return () => {
            window.removeEventListener("resize", checkMobileTimer);
        };
    }, []);

    function openEndModal(actualMinutes: number) {
        completeSession(actualMinutes);
    }

    async function completeSession(actualMinutes: number) {
        if (!id) return;

        hasCompletedSessionRef.current = true;
        isLeavingPageRef.current = true;

        const nextData = data;

        setData(nextData);
        setIsRunning(false);
        endTimeRef.current = null;

        const { error } = await supabase
            .from("study_sessions")
            .update({
                planning_data: nextData,
                planning: nextData.goal,
                status: "done",
                duration: actualMinutes,
                remaining_seconds: null,
                started_at: null,
                paused_at: null,
            })
            .eq("id", id);

        if (error) {
            alert(error.message);
            return;
        }

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
            setShowBreakSuggestion(false);
            setActiveStudySeconds(0);
            await pauseSession(true);
        } else {
            const remaining = secondsRef.current;

            endTimeRef.current = Date.now() + remaining * 1000;
            lastSavedSecondRef.current = remaining;

            const { error } = await supabase
                .from("study_sessions")
                .update({
                    status: "active",
                    remaining_seconds: remaining,
                    started_at: new Date().toISOString(),
                    paused_at: null,
                })
                .eq("id", id);

            if (error) {
                alert(error.message);
                return;
            }

            setIsRunning(true);
            setSessionStatus("active");
        }
    }

    async function stopEarly() {
        setShowBreakSuggestion(false);
        setActiveStudySeconds(0);

        const remaining = getCurrentRemainingSeconds();
        const studiedSeconds = plannedMinutes * 60 - remaining;
        const actualMinutes = Math.max(1, Math.round(studiedSeconds / 60));

        secondsRef.current = remaining;
        setSecondsLeft(remaining);
        endTimeRef.current = null;

        await completeSession(actualMinutes);
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

    function completeNextTask() {
        if (!nextTask) return;

        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === nextTask.blockId
                    ? {
                        ...block,
                        checklist: block.checklist.map((item) =>
                            item.id === nextTask.id ? { ...item, done: true } : item
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

    function toggleBlockCollapsed(blockId: string) {
        setCollapsedBlockIds((current) =>
            current.includes(blockId)
                ? current.filter((id) => id !== blockId)
                : [...current, blockId]
        );
    }

    function updateBlockNote(blockId: string, note: string) {
        scheduleSave({
            ...data,
            blocks: data.blocks.map((block) =>
                block.id === blockId ? { ...block, note } : block
            ),
        });
    }

    function getLinkProvider(url: string): ResourceItem["provider"] {
        try {
            const hostname = new URL(url).hostname.replace("www.", "");

            if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
                return "youtube";
            }

            if (hostname.includes("quizlet.com")) {
                return "quizlet";
            }

            if (hostname.includes("drive.google.com")) {
                return "drive";
            }

            return "link";
        } catch {
            return "link";
        }
    }

    function getResourceIcon(resource: ResourceItem) {
        if (resource.type === "image") return "🖼️";
        if (resource.type === "file") return "📄";

        if (resource.provider === "youtube") return "▶️";
        if (resource.provider === "quizlet") return "🧠";
        if (resource.provider === "drive") return "📁";

        return "🔗";
    }

    async function fetchLinkTitle(urlValue: string) {
        const url = urlValue.trim();

        if (!url) return null;

        setLoadingLinkTitle(true);

        try {
            const response = await fetch("/api/link-preview", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            });

            const result = await response.json();

            if (result.url) {
                setResourceUrl(result.url);
            }

            if (result.title && !resourceTitle.trim()) {
                setResourceTitle(result.title);
            }

            return {
                title: result.title || "Länk",
                url: result.url || url,
                provider: getLinkProvider(result.url || url),
            };
        } catch {
            return {
                title: "Länk",
                url,
                provider: getLinkProvider(url),
            };
        } finally {
            setLoadingLinkTitle(false);
        }
    }

    async function addLink() {
        const rawUrl = resourceUrl.trim();

        if (!rawUrl) return;

        let formattedUrl =
            rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
                ? rawUrl
                : `https://${rawUrl}`;

        let title = resourceTitle.trim();
        let provider = getLinkProvider(formattedUrl);

        if (!title) {
            const preview = await fetchLinkTitle(formattedUrl);

            if (preview) {
                formattedUrl = preview.url;
                title = preview.title;
                provider = preview.provider;
            }
        }

        scheduleSave({
            ...data,
            resources: [
                ...data.resources,
                {
                    id: uid(),
                    type: "link",
                    provider,
                    title: title || "Länk",
                    url: formattedUrl,
                },
            ],
        });

        setResourceTitle("");
        setResourceUrl("");
    }

    async function uploadResource(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file || !id) return;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            alert(`Filen är för stor. Maxstorlek är ${MAX_FILE_SIZE_MB} MB.`);
            event.target.value = "";
            return;
        }

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
        const resource = data.resources.find((resource) => resource.id === resourceId);

        if (!resource) return;

        const confirmed = window.confirm(
            `Är du säker på att du vill ta bort "${resource.title}"?`
        );

        if (!confirmed) return;

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
        stopDoneTabAlert();

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
                paused_at: null,
            })
            .eq("id", id);
    }

    function continueToEndReview() {
        if (originalTitleRef.current) {
            document.title = originalTitleRef.current;
        }
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
                position: "relative",
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



                {isStudyMode && (
                    <div
                        ref={timerCardRef}
                        className="pass-timer-card"
                        onMouseDown={(event) => {
                            if (isMobileTimer) return;
                            const rect = event.currentTarget.getBoundingClientRect();

                            const currentPosition = {
                                x: rect.left,
                                y: rect.top,
                            };

                            timerLatestPositionRef.current = currentPosition;

                            event.currentTarget.style.top = "0px";
                            event.currentTarget.style.right = "auto";
                            event.currentTarget.style.left = "0px";
                            event.currentTarget.style.transform =
                                `translate3d(${currentPosition.x}px, ${currentPosition.y}px, 0)`;

                            setTimerPosition(currentPosition);

                            timerDragOffsetRef.current = {
                                x: event.clientX - rect.left,
                                y: event.clientY - rect.top,
                            };

                            setTimerDragging(true);
                        }}
                        style={{
                            background: "rgba(15, 23, 42, 0.92)",
                            borderRadius: "18px",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.28)",
                            position: isMobileTimer ? "sticky" : "fixed",
                            top: isMobileTimer ? "12px" : timerPosition ? 0 : "100px",
                            right: isMobileTimer ? "auto" : timerPosition ? "auto" : "32px",
                            left: isMobileTimer ? "auto" : timerPosition ? 0 : "auto",
                            transform: isMobileTimer
                                ? "none"
                                : timerPosition
                                    ? `translate3d(${timerPosition.x}px, ${timerPosition.y}px, 0)`
                                    : "none",
                            willChange: isMobileTimer ? "auto" : "transform",
                            cursor: isMobileTimer ? "default" : timerDragging ? "grabbing" : "grab",
                            userSelect: "none",
                            zIndex: 20,
                            padding: "18px",
                            width: isMobileTimer ? "100%" : "230px",
                            maxWidth: isMobileTimer ? "420px" : "230px",
                            margin: isMobileTimer ? "12px auto 18px" : undefined,
                            textAlign: "center",
                            border: "1px solid rgba(148, 163, 184, 0.18)",
                            transition: timerDragging ? "none" : "box-shadow 0.2s ease, border-color 0.2s ease",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginBottom: timerMinimized ? "10px" : "6px",
                            }}
                        >
                            <button
                                onClick={() => setTimerMinimized((v) => !v)}
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "999px",
                                    border: "1px solid rgba(148, 163, 184, 0.28)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "#e2e8f0",
                                    cursor: "pointer",
                                    fontWeight: 900,
                                    fontSize: "20px",
                                    lineHeight: 1,
                                }}
                                type="button"
                                title={timerMinimized ? "Visa klocka" : "Dölj klocka"}
                            >
                                {timerMinimized ? "+" : "−"}
                            </button>
                        </div>

                        {!timerMinimized && (
                            <div
                                style={{
                                    fontSize: "42px",
                                    fontWeight: "bold",
                                    marginBottom: "18px",
                                    textAlign: "center",
                                    width: "100%",
                                }}
                            >
                                {formatTime(secondsLeft)}
                            </div>
                        )}

                        <button
                            onClick={togglePause}
                            style={{ ...smallButton, width: "100%", marginBottom: "8px" }}
                            type="button"
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
                            type="button"
                        >
                            Avsluta tidigare
                        </button>

                        {showBreakSuggestion && (
                            <div
                                style={{
                                    marginTop: "12px",
                                    padding: "12px",
                                    borderRadius: "14px",
                                    background: "rgba(59, 130, 246, 0.14)",
                                    border: "1px solid rgba(96, 165, 250, 0.32)",
                                    textAlign: "left",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "13px",
                                        fontWeight: 800,
                                        color: "#bfdbfe",
                                        marginBottom: "4px",
                                    }}
                                >
                                    Pausförslag
                                </div>

                                <div
                                    style={{
                                        fontSize: "13px",
                                        lineHeight: 1.45,
                                        color: "#cbd5e1",
                                    }}
                                >
                                    Du har fokuserat i ungefär 30 min. Ta gärna en 5 min paus innan du fortsätter.
                                </div>

                                <div
                                    style={{
                                        display: "grid",
                                        gap: "8px",
                                        marginTop: "10px",
                                    }}
                                >
                                    <button
                                        onClick={startSuggestedBreak}
                                        style={{
                                            ...smallButton,
                                            background: "rgba(37, 99, 235, 0.85)",
                                            border: "none",
                                            color: "white",
                                        }}
                                        type="button"
                                    >
                                        Ta 5 min paus
                                    </button>

                                    <button
                                        onClick={() => setShowBreakSuggestion(false)}
                                        style={{
                                            ...smallButton,
                                            background: "rgba(255,255,255,0.04)",
                                            color: "#cbd5e1",
                                        }}
                                        type="button"
                                    >
                                        Fortsätt
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: "14px" }}>
                            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                        </div>
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
                                {data.blocks.map((block, index) => {
                                    const isCollapsed = collapsedBlockIds.includes(block.id);
                                    const blockDoneCount = block.checklist.filter((item) => item.done).length;
                                    const blockTotalCount = block.checklist.length;

                                    return (
                                        <div
                                            key={block.id}
                                            style={{
                                                border: "1px solid rgba(148,163,184,.16)",
                                                borderRadius: "14px",
                                                padding: "16px",
                                                background: "rgba(30,41,59,.35)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    gap: "12px",
                                                }}
                                            >
                                                <button
                                                    onClick={() => toggleBlockCollapsed(block.id)}
                                                    type="button"
                                                    style={{
                                                        flex: 1,
                                                        minHeight: "auto",
                                                        padding: 0,
                                                        border: "none",
                                                        background: "transparent",
                                                        color: "inherit",
                                                        textAlign: "left",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <h3 style={{ margin: 0, fontSize: "17px", color: "#f8fafc" }}>
                                                        Steg {index + 1} – {block.title.replace(/^Steg \d+ – /, "")}
                                                    </h3>

                                                    <div
                                                        style={{
                                                            marginTop: "5px",
                                                            color: "#94a3b8",
                                                            fontSize: "13px",
                                                        }}
                                                    >
                                                        {blockTotalCount === 0
                                                            ? "Inga checkrutor"
                                                            : `${blockDoneCount}/${blockTotalCount} klart`}
                                                    </div>
                                                </button>

                                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>

                                                    <button
                                                        onClick={() => toggleBlockCollapsed(block.id)}
                                                        style={{
                                                            ...smallButton,
                                                            width: "42px",
                                                            padding: "8px 0",
                                                            fontSize: "18px",
                                                        }}
                                                        type="button"
                                                        title={isCollapsed ? "Visa steg" : "Dölj steg"}
                                                    >
                                                        {isCollapsed ? "+" : "−"}
                                                    </button>
                                                </div>
                                            </div>

                                            {!isCollapsed && (
                                                <>
                                                    <p style={{ margin: "8px 0 14px", color: "#94a3b8" }}>
                                                        {block.subtitle}
                                                    </p>

                                                    <div
                                                        className="pass-block-inner-grid"
                                                        style={{
                                                            display: "block",
                                                        }}
                                                    >
                                                        <div style={{ minWidth: 0 }}>

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
                                                                    {!readOnly && (
                                                                        <button
                                                                            onClick={() => removeChecklistItem(block.id, item.id)}
                                                                            style={{
                                                                                ...smallButton,
                                                                                width: "34px",
                                                                                height: "34px",
                                                                                minHeight: "34px",
                                                                                padding: 0,
                                                                                borderRadius: "10px",
                                                                                color: "#fecaca",
                                                                                background: "rgba(239, 68, 68, 0.12)",
                                                                                border: "1px solid rgba(248, 113, 113, 0.35)",
                                                                            }}
                                                                            type="button"
                                                                            title="Ta bort checkruta"
                                                                        >
                                                                            ×
                                                                        </button>
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
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
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

                            {allChecklist.length === 0 ? (
                                <p style={{ color: "#94a3b8" }}>Inga checkrutor inlagda ännu.</p>
                            ) : (
                                <>
                                    {isStudyMode && nextTask && (
                                        <div
                                            style={{
                                                padding: "14px",
                                                borderRadius: "14px",
                                                background: "rgba(37, 99, 235, 0.16)",
                                                border: "1px solid rgba(96, 165, 250, 0.35)",
                                                marginBottom: "14px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    color: "#93c5fd",
                                                    fontSize: "13px",
                                                    fontWeight: "bold",
                                                    marginBottom: "6px",
                                                }}
                                            >
                                                Nästa
                                            </div>

                                            <div
                                                style={{
                                                    color: "#f8fafc",
                                                    fontWeight: "bold",
                                                    overflowWrap: "anywhere",
                                                    lineHeight: 1.45,
                                                }}
                                            >
                                                ⬜ {nextTask.text || "Namnlös checkruta"}
                                            </div>

                                            <div
                                                style={{
                                                    color: "#94a3b8",
                                                    fontSize: "12px",
                                                    marginTop: "6px",
                                                }}
                                            >
                                                {nextTask.blockTitle.replace(/^Steg \d+ – /, "")}
                                            </div>

                                            {!readOnly && (
                                                <button
                                                    onClick={completeNextTask}
                                                    style={{
                                                        ...smallButton,
                                                        width: "100%",
                                                        marginTop: "12px",
                                                        background: "#16a34a",
                                                        border: "none",
                                                        color: "white",
                                                    }}
                                                    type="button"
                                                >
                                                    Markera klar
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {isStudyMode && !nextTask && (
                                        <div
                                            style={{
                                                padding: "14px",
                                                borderRadius: "14px",
                                                background: "rgba(22, 163, 74, 0.14)",
                                                border: "1px solid rgba(34, 197, 94, 0.32)",
                                                color: "#bbf7d0",
                                                fontWeight: "bold",
                                                marginBottom: "14px",
                                            }}
                                        >
                                            Alla checkrutor är klara 🎉
                                        </div>
                                    )}

                                    <div style={{ display: "grid", gap: "9px" }}>
                                        {allChecklist.slice(0, 8).map((item) => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    color: item.done ? "#86efac" : "#cbd5e1",
                                                    overflowWrap: "anywhere",
                                                    fontSize: "14px",
                                                    lineHeight: 1.4,
                                                }}
                                            >
                                                {item.done ? "✅" : "⬜"} {item.text || "Namnlös checkruta"}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h3 style={{ marginTop: 0 }}>Resurser</h3>

                            {!readOnly && (
                                <div style={{ display: "grid", gap: "14px", marginBottom: "14px" }}>
                                    <div
                                        style={{
                                            display: "grid",
                                            gap: "10px",
                                            padding: "12px",
                                            borderRadius: "14px",
                                            background: "rgba(15, 23, 42, 0.45)",
                                            border: "1px solid rgba(148,163,184,.16)",
                                        }}
                                    >
                                        <strong>Lägg till länk</strong>

                                        {resourceUrl.trim() && (
                                            <input
                                                value={resourceTitle}
                                                onChange={(event) => setResourceTitle(event.target.value)}
                                                placeholder={loadingLinkTitle ? "Hämtar titel..." : "Titel fylls i automatiskt"}
                                                style={inputStyle}
                                            />
                                        )}

                                        <input
                                            value={resourceUrl}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setResourceUrl(value);

                                                if (value.includes("http") || value.includes(".")) {
                                                    fetchLinkTitle(value);
                                                }
                                            }}
                                            placeholder="Klistra in länk här..."
                                            style={inputStyle}
                                        />

                                        {resourceUrl.trim() && (
                                            <button
                                                onClick={addLink}
                                                disabled={loadingLinkTitle}
                                                style={{
                                                    ...smallButton,
                                                    opacity: loadingLinkTitle ? 0.65 : 1,
                                                }}
                                                type="button"
                                            >
                                                {loadingLinkTitle ? "Hämtar titel..." : "+ Lägg till länk"}
                                            </button>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            display: "grid",
                                            gap: "10px",
                                            padding: "12px",
                                            borderRadius: "14px",
                                            background: "rgba(15, 23, 42, 0.45)",
                                            border: "1px solid rgba(148,163,184,.16)",
                                        }}
                                    >
                                        <strong>Ladda upp fil/bild</strong>
                                        <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
                                            Max {MAX_FILE_SIZE_MB} MB per fil.
                                        </p>

                                        <label
                                            style={{
                                                ...smallButton,
                                                display: "block",
                                                textAlign: "center",
                                            }}
                                        >
                                            {uploading ? "Laddar upp..." : "Välj fil eller bild"}
                                            <input
                                                hidden
                                                type="file"
                                                accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
                                                onChange={uploadResource}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {data.resources.length === 0 ? (
                                <p style={{ color: "#94a3b8", margin: 0 }}>
                                    Inga resurser tillagda ännu.
                                </p>
                            ) : (
                                <div style={{ display: "grid", gap: "10px" }}>
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
                                                    lineHeight: 1.4,
                                                    display: "block",
                                                }}
                                            >
                                                {getResourceIcon(resource)} {resource.title}
                                            </a>

                                            <div
                                                style={{
                                                    color: "#94a3b8",
                                                    fontSize: "13px",
                                                    marginTop: "6px",
                                                }}
                                            >
                                                {resource.mimeType || "Länk"} {formatBytes(resource.sizeBytes)}
                                            </div>

                                            {!readOnly && (
                                                <button
                                                    onClick={() => removeResource(resource.id)}
                                                    style={{
                                                        ...smallButton,
                                                        marginTop: "10px",
                                                        width: "100%",
                                                    }}
                                                    type="button"
                                                >
                                                    Ta bort
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
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

            {showBreakModal && (
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
                            width: "420px",
                            maxWidth: "calc(100vw - 48px)",
                            background: "#0f172a",
                            border: "1px solid rgba(148, 163, 184, 0.25)",
                            borderRadius: "20px",
                            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                            padding: "24px",
                            textAlign: "center",
                        }}
                    >
                        <div style={{ fontSize: "42px", marginBottom: "10px" }}>
                            {breakDone ? "🚀" : "☕"}
                        </div>

                        <h2 style={{ margin: 0, color: "#f8fafc" }}>
                            {breakDone ? "Redo att sätta igång igen?" : "Ta en kort paus"}
                        </h2>

                        <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                            {breakDone
                                ? "Pausen är klar. Fortsätt när du känner dig redo."
                                : "Vila ögonen, sträck på dig eller hämta vatten."}
                        </p>

                        <div
                            style={{
                                fontSize: "52px",
                                fontWeight: 900,
                                color: "#f8fafc",
                                margin: "18px 0",
                                letterSpacing: "-1px",
                            }}
                        >
                            {formatTime(breakSecondsLeft)}
                        </div>

                        <button
                            onClick={finishSuggestedBreak}
                            style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: "12px",
                                border: "none",
                                background: breakDone
                                    ? "linear-gradient(90deg,#16a34a,#22c55e)"
                                    : "rgba(37, 99, 235, 0.9)",
                                color: "white",
                                fontWeight: "bold",
                                cursor: "pointer",
                                fontSize: "15px",
                            }}
                            type="button"
                        >
                            {breakDone ? "Fortsätt plugga" : "Fortsätt tidigare"}
                        </button>
                    </div>
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
