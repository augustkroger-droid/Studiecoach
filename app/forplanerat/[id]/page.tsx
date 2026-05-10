"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
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

type StudyBlock = {
    id: string;
    type: BlockType;
    title: string;
    subtitle: string;
    checklist: ChecklistItem[];
    note: string;
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

type AssignedStudyTemplate = {
    id: string;
    template_id: string | null;
    admin_id: string;
    student_id: string;
    title: string;
    subject: string;
    area: string;
    duration: number;
    planning: string | null;
    planning_data: any;
    status: "available" | "used";
};

const DEFAULT_BLOCKS: Omit<StudyBlock, "id" | "checklist" | "note">[] = [
    {
        type: "understand",
        title: "Förstå",
        subtitle: "Lägg in det eleven ska läsa, titta på eller förstå.",
    },
    {
        type: "practice",
        title: "Träna",
        subtitle: "Lägg in övningar, uppgifter eller saker eleven ska göra.",
    },
    {
        type: "quiz",
        title: "Testa dig själv",
        subtitle: "Lägg in frågor, Quizlet, övningsprov eller annat.",
    },
    {
        type: "repeat",
        title: "Repetera",
        subtitle: "Lägg in sådant som ska repeteras eller göras om.",
    },
];

function uid() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

export default function AdminStudyTemplatePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [saving, setSaving] = useState(false);

    const [template, setTemplate] = useState<AssignedStudyTemplate | null>(null);
    const [title, setTitle] = useState("");
    const [subject, setSubject] = useState("");
    const [area, setArea] = useState("");
    const [duration, setDuration] = useState(30);
    const [data, setData] = useState<PlanningData>(() => defaultPlanningData());
    const [collapsedBlockIds, setCollapsedBlockIds] = useState<string[]>([]);
    const [resourceTitle, setResourceTitle] = useState("");
    const [resourceUrl, setResourceUrl] = useState("");
    const [loadingLinkTitle, setLoadingLinkTitle] = useState(false);

    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];

    const allChecklist = useMemo(
        () => data.blocks.flatMap((block) => block.checklist),
        [data.blocks]
    );

    const doneCount = allChecklist.filter((item) => item.done).length;
    const totalCount = allChecklist.length;
    const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

    useEffect(() => {
        loadTemplate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    function scheduleSave(nextData: PlanningData) {
        setData(nextData);

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        saveTimerRef.current = setTimeout(() => {
            saveTemplate(nextData);
        }, 500);
    }

    async function loadTemplate() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        setAllowed(true);

        const { data: templateData, error } = await supabase
            .from("assigned_study_templates")
            .select("*")
            .eq("id", id)
            .eq("student_id", user.id)
            .eq("status", "available")
            .single();

        if (error) {
            alert(error.message);
            router.push("/kalender");
            return;
        }

        const nextPlanningData = normalizePlanningData(
            templateData.planning_data,
            templateData.planning || ""
        );

        setTemplate(templateData);
        setTitle(templateData.title);
        setSubject(templateData.subject);
        setArea(templateData.area || "");
        setDuration(templateData.duration || 30);
        setData(nextPlanningData);
        setLoading(false);
    }

    async function saveTemplate(nextData = data) {
        if (!template) return;

        setSaving(true);

        const { error } = await supabase
            .from("assigned_study_templates")
            .update({
                title: title.trim() || "Namnlöst studiepass",
                subject: subject.trim() || "Ämne",
                area: area.trim(),
                duration,
                planning: nextData.goal,
                planning_data: nextData,
            })
            .eq("id", template.id);

        setSaving(false);

        if (error) {
            alert(error.message);
            return;
        }
    }

    function updateGoal(goal: string) {
        scheduleSave({ ...data, goal });
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
                        checklist: [
                            ...block.checklist,
                            { id: uid(), text: "", done: false },
                        ],
                    }
                    : block
            ),
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
                ? current.filter((item) => item !== blockId)
                : [...current, blockId]
        );
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

    function removeResource(resourceId: string) {
        const confirmed = window.confirm("Vill du ta bort denna resurs?");

        if (!confirmed) return;

        scheduleSave({
            ...data,
            resources: data.resources.filter((resource) => resource.id !== resourceId),
        });
    }

    const inputStyle = {
        width: "100%",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        background: "rgba(15, 23, 42, 0.65)",
        color: "#e2e8f0",
        borderRadius: "12px",
        padding: "11px 12px",
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

    if (loading) {
        return (
            <main style={{ minHeight: "100vh", padding: "32px", background: theme.background, color: theme.text }}>
                <NavBar />
                <p>Laddar studiepass...</p>
            </main>
        );
    }

    if (!allowed) {
        return (
            <main style={{ minHeight: "100vh", padding: "32px", background: theme.background, color: theme.text }}>
                <NavBar />
                <h1>Inte tillåtet</h1>
                <p>Du har inte behörighet att redigera detta studiepass.</p>
            </main>
        );
    }

    return (
        <main
            style={{
                minHeight: "100vh",
                padding: "32px",
                fontFamily: "Arial, sans-serif",
                background: theme.background,
                color: theme.text,
            }}
        >
            <NavBar />
            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />

            <div
                style={{
                    maxWidth: "1180px",
                    margin: "24px auto 0",
                }}
            >
                <button
                    onClick={() => router.push("/kalender")}
                    style={smallButton}
                >
                    ← Tillbaka till kalendern
                </button>

                <section
                    style={{
                        ...cardStyle,
                        padding: "20px",
                        marginTop: "18px",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr 1fr 120px",
                            gap: "12px",
                        }}
                    >
                        <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            onBlur={() => saveTemplate()}
                            placeholder="Titel"
                            style={{
                                ...inputStyle,
                                fontSize: "22px",
                                fontWeight: "bold",
                            }}
                        />

                        <input
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                            onBlur={() => saveTemplate()}
                            placeholder="Ämne"
                            style={inputStyle}
                        />

                        <input
                            value={area}
                            onChange={(event) => setArea(event.target.value)}
                            onBlur={() => saveTemplate()}
                            placeholder="Område"
                            style={inputStyle}
                        />

                        <input
                            type="number"
                            min={1}
                            value={duration}
                            onChange={(event) => setDuration(Number(event.target.value))}
                            onBlur={() => saveTemplate()}
                            placeholder="Min"
                            style={inputStyle}
                        />
                    </div>

                    <p style={{ color: "#94a3b8", marginBottom: 0 }}>
                        {saving ? "Sparar..." : "Sparat automatiskt"}
                    </p>
                </section>

                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 760px) minmax(280px, 1fr)",
                        gap: "22px",
                        marginTop: "22px",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h2 style={{ marginTop: 0 }}>Vad ska jag lära mig?</h2>

                            <textarea
                                value={data.goal}
                                onChange={(event) => updateGoal(event.target.value)}
                                rows={4}
                                placeholder="Skriv vad du ska kunna efter passet..."
                                style={{ ...inputStyle, resize: "vertical" }}
                            />
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "14px",
                                    gap: "12px",
                                }}
                            >
                                <h2 style={{ margin: 0 }}>Plan – vad ska göras?</h2>

                                <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                                    {progress}% klart i mallen
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
                                                    gap: "12px",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <button
                                                    onClick={() => toggleBlockCollapsed(block.id)}
                                                    type="button"
                                                    style={{
                                                        flex: 1,
                                                        padding: 0,
                                                        border: "none",
                                                        background: "transparent",
                                                        color: "inherit",
                                                        textAlign: "left",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <h3 style={{ margin: 0 }}>
                                                        Steg {index + 1} – {block.title}
                                                    </h3>

                                                    <div style={{ marginTop: "5px", color: "#94a3b8", fontSize: "13px" }}>
                                                        {blockTotalCount === 0
                                                            ? "Inga checkrutor"
                                                            : `${blockDoneCount}/${blockTotalCount} klart`}
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => toggleBlockCollapsed(block.id)}
                                                    style={smallButton}
                                                    type="button"
                                                >
                                                    {isCollapsed ? "+" : "−"}
                                                </button>
                                            </div>

                                            {!isCollapsed && (
                                                <>
                                                    <p style={{ color: "#94a3b8" }}>{block.subtitle}</p>

                                                    {block.checklist.map((item) => (
                                                        <label
                                                            key={item.id}
                                                            style={{
                                                                display: "grid",
                                                                gridTemplateColumns: "24px 1fr 34px",
                                                                alignItems: "center",
                                                                gap: "10px",
                                                                marginBottom: "12px",
                                                            }}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={item.done}
                                                                onChange={() => toggleChecklist(block.id, item.id)}
                                                            />

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
                                                                }}
                                                            />

                                                            <button
                                                                onClick={() => removeChecklistItem(block.id, item.id)}
                                                                style={{
                                                                    ...smallButton,
                                                                    color: "#fecaca",
                                                                    background: "rgba(239, 68, 68, 0.12)",
                                                                    border: "1px solid rgba(248, 113, 113, 0.35)",
                                                                    padding: 0,
                                                                    height: "34px",
                                                                }}
                                                                type="button"
                                                            >
                                                                ×
                                                            </button>
                                                        </label>
                                                    ))}

                                                    <button
                                                        onClick={() => addChecklistItem(block.id)}
                                                        style={smallButton}
                                                        type="button"
                                                    >
                                                        + Lägg till checkruta
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h3 style={{ marginTop: 0 }}>Framsteg i mallen</h3>

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
                                {progress}% · {doneCount} av {totalCount} checkrutor markerade
                            </p>
                        </div>

                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h3 style={{ marginTop: 0 }}>Checklista snabbvy</h3>

                            {allChecklist.length === 0 ? (
                                <p style={{ color: "#94a3b8" }}>
                                    Inga checkrutor inlagda ännu.
                                </p>
                            ) : (
                                <div style={{ display: "grid", gap: "9px" }}>
                                    {allChecklist.slice(0, 10).map((item) => (
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
                            )}
                        </div>
                        <div style={{ ...cardStyle, padding: "18px" }}>
                            <h3 style={{ marginTop: 0 }}>Resurser</h3>

                            <div
                                style={{
                                    display: "grid",
                                    gap: "10px",
                                    padding: "12px",
                                    borderRadius: "14px",
                                    background: "rgba(15, 23, 42, 0.45)",
                                    border: "1px solid rgba(148,163,184,.16)",
                                    marginBottom: "14px",
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
                                                {resource.provider || "länk"}
                                            </div>

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
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </aside>
                </section>
            </div>

            <style jsx>{`
                @media (max-width: 900px) {
                    main {
                        padding: 18px !important;
                    }

                    section {
                        max-width: 100%;
                    }

                    input,
                    textarea,
                    button {
                        font-size: 16px !important;
                    }

                    div[style*="grid-template-columns: 2fr 1fr 1fr 120px"] {
                        grid-template-columns: 1fr !important;
                    }

                    section[style*="grid-template-columns: minmax(0, 760px)"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </main>
    );
}