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

type AdminStudyTemplate = {
    id: string;
    admin_id: string;
    title: string;
    subject: string;
    area: string;
    duration: number;
    planning: string | null;
    planning_data: any;
    folder_id: string | null;
    created_at: string;
    updated_at: string;
};

type AdminTemplateFolder = {
    id: string;
    admin_id: string;
    name: string;
    created_at: string;
};

export default function AdminPassPage() {
    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];

    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [adminClasses, setAdminClasses] = useState<AdminClass[]>([]);
    const [classStudents, setClassStudents] = useState<AdminClassStudent[]>([]);

    const [studyTemplates, setStudyTemplates] = useState<AdminStudyTemplate[]>([]);
    const [templateFolders, setTemplateFolders] = useState<AdminTemplateFolder[]>([]);
    const [newTemplateFolderName, setNewTemplateFolderName] = useState("");
    const [openTemplateFolderIds, setOpenTemplateFolderIds] = useState<string[]>([]);

    const [showTemplateEditor, setShowTemplateEditor] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<AdminStudyTemplate | null>(null);

    const [templateTitle, setTemplateTitle] = useState("");
    const [templateSubject, setTemplateSubject] = useState("");
    const [templateArea, setTemplateArea] = useState("");
    const [templateDuration, setTemplateDuration] = useState(30);
    const [templatePlanning, setTemplatePlanning] = useState("");

    const [templateToSend, setTemplateToSend] = useState<AdminStudyTemplate | null>(null);
    const [selectedStudentIdsToSend, setSelectedStudentIdsToSend] = useState<string[]>([]);
    const [openSendClassIds, setOpenSendClassIds] = useState<string[]>([]);
    const [sendOtherUsersOpen, setSendOtherUsersOpen] = useState(false);

    useEffect(() => {
        loadAdminPassData();
    }, []);

    async function loadAdminPassData() {
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
            .select("id, username, is_admin")
            .order("username", { ascending: true });

        if (profileError) {
            alert(profileError.message);
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

        const { data: templateData, error: templateError } = await supabase
            .from("admin_study_templates")
            .select("*")
            .eq("admin_id", currentAdminId)
            .order("created_at", { ascending: false });

        if (templateError) {
            alert(templateError.message);
        }

        const { data: templateFolderData, error: templateFolderError } = await supabase
            .from("admin_template_folders")
            .select("*")
            .eq("admin_id", currentAdminId)
            .order("name", { ascending: true });

        if (templateFolderError) {
            alert(templateFolderError.message);
        }

        setProfiles(profileData || []);
        setAdminClasses(classData || []);
        setClassStudents(classStudentData || []);
        setStudyTemplates(templateData || []);
        setTemplateFolders(templateFolderData || []);
        setLoading(false);
    }

    function isStudentInAnyClass(studentId: string) {
        return classStudents.some((row) => row.student_id === studentId);
    }

    function toggleTemplateFolderOpen(folderId: string) {
        setOpenTemplateFolderIds((current) =>
            current.includes(folderId)
                ? current.filter((id) => id !== folderId)
                : [...current, folderId]
        );
    }

    async function createTemplateFolder() {
        const name = newTemplateFolderName.trim();

        if (!name) return;

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const { error } = await supabase
            .from("admin_template_folders")
            .insert({
                admin_id: user.id,
                name,
            });

        if (error) {
            alert(error.message);
            return;
        }

        setNewTemplateFolderName("");
        loadAdminPassData();
    }

    async function assignTemplateToFolder(templateId: string, folderId: string | null) {
        const { error } = await supabase
            .from("admin_study_templates")
            .update({
                folder_id: folderId,
            })
            .eq("id", templateId);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminPassData();
    }

    async function deleteTemplateFolder(folderId: string) {
        const confirmed = window.confirm(
            "Ta bort kursmappen? Studiepassen tas INTE bort, utan flyttas till 'Utan kursmapp'."
        );

        if (!confirmed) return;

        const secondConfirm = window.confirm(
            "Är du helt säker? Bara mappen tas bort, inte passen."
        );

        if (!secondConfirm) return;

        const { error } = await supabase
            .from("admin_template_folders")
            .delete()
            .eq("id", folderId);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminPassData();
    }

    function openNewTemplateEditor() {
        setSelectedTemplate(null);
        setTemplateTitle("");
        setTemplateSubject("");
        setTemplateArea("");
        setTemplateDuration(30);
        setTemplatePlanning("");
        setShowTemplateEditor(true);
    }

    function closeTemplateEditor() {
        setSelectedTemplate(null);
        setTemplateTitle("");
        setTemplateSubject("");
        setTemplateArea("");
        setTemplateDuration(30);
        setTemplatePlanning("");
        setShowTemplateEditor(false);
    }

    async function saveStudyTemplate() {
        const title = templateTitle.trim();
        const subject = templateSubject.trim();
        const area = templateArea.trim();
        const planning = templatePlanning.trim();

        if (!title || !subject) {
            alert("Titel och ämne måste fyllas i.");
            return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const templatePayload = {
            admin_id: user.id,
            title,
            subject,
            area,
            duration: templateDuration,
            planning: planning || null,
            planning_data: {
                goal: planning,
                priority: "Medel",
                blocks: [
                    {
                        id: crypto.randomUUID(),
                        type: "understand",
                        title: "Förstå",
                        subtitle: "Lägg in det eleven ska läsa, titta på eller förstå.",
                        checklist: [],
                        note: "",
                    },
                    {
                        id: crypto.randomUUID(),
                        type: "practice",
                        title: "Träna",
                        subtitle: "Lägg in övningar, uppgifter eller saker eleven ska göra.",
                        checklist: [],
                        note: "",
                    },
                    {
                        id: crypto.randomUUID(),
                        type: "quiz",
                        title: "Testa dig själv",
                        subtitle: "Lägg in frågor, Quizlet, övningsprov eller annat.",
                        checklist: [],
                        note: "",
                    },
                    {
                        id: crypto.randomUUID(),
                        type: "repeat",
                        title: "Repetera",
                        subtitle: "Lägg in sådant som ska repeteras eller göras om.",
                        checklist: [],
                        note: "",
                    },
                ],
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
            },
            folder_id: null,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = selectedTemplate
            ? await supabase
                .from("admin_study_templates")
                .update(templatePayload)
                .eq("id", selectedTemplate.id)
                .select()
                .single()
            : await supabase
                .from("admin_study_templates")
                .insert(templatePayload)
                .select()
                .single();

        if (error) {
            alert(error.message);
            return;
        }

        closeTemplateEditor();

        if (data?.id) {
            window.location.href = `/admin/studiepass/${data.id}`;
            return;
        }

        loadAdminPassData();
    }

    async function deleteStudyTemplate(templateId: string) {
        const confirmed = window.confirm("Vill du ta bort detta förplanerade studiepass?");

        if (!confirmed) return;

        const secondConfirm = window.confirm(
            "Är du helt säker? Detta tar bort själva passmallen."
        );

        if (!secondConfirm) return;

        const { error } = await supabase
            .from("admin_study_templates")
            .delete()
            .eq("id", templateId);

        if (error) {
            alert(error.message);
            return;
        }

        loadAdminPassData();
    }

    function openSendTemplate(template: AdminStudyTemplate) {
        setTemplateToSend(template);
        setSelectedStudentIdsToSend([]);
        setOpenSendClassIds([]);
        setSendOtherUsersOpen(false);
    }

    function closeSendTemplate() {
        setTemplateToSend(null);
        setSelectedStudentIdsToSend([]);
        setOpenSendClassIds([]);
        setSendOtherUsersOpen(false);
    }

    function toggleStudentForTemplate(studentId: string) {
        setSelectedStudentIdsToSend((current) =>
            current.includes(studentId)
                ? current.filter((id) => id !== studentId)
                : [...current, studentId]
        );
    }

    function toggleSendClassOpen(classId: string) {
        setOpenSendClassIds((current) =>
            current.includes(classId)
                ? current.filter((id) => id !== classId)
                : [...current, classId]
        );
    }

    function toggleAllStudentsInClass(studentIds: string[]) {
        const allSelected = studentIds.every((studentId) =>
            selectedStudentIdsToSend.includes(studentId)
        );

        setSelectedStudentIdsToSend((current) => {
            if (allSelected) {
                return current.filter((studentId) => !studentIds.includes(studentId));
            }

            return Array.from(new Set([...current, ...studentIds]));
        });
    }

    function toggleAllOtherUsers(studentIds: string[]) {
        toggleAllStudentsInClass(studentIds);
    }

    async function sendTemplateToStudents() {
        if (!templateToSend || selectedStudentIdsToSend.length === 0) {
            alert("Välj minst en elev.");
            return;
        }

        const rows = selectedStudentIdsToSend.map((studentId) => ({
            template_id: templateToSend.id,
            admin_id: templateToSend.admin_id,
            student_id: studentId,
            title: templateToSend.title,
            subject: templateToSend.subject,
            area: templateToSend.area,
            duration: templateToSend.duration,
            planning: templateToSend.planning,
            planning_data: templateToSend.planning_data,
            status: "available",
        }));

        const { error } = await supabase
            .from("assigned_study_templates")
            .insert(rows);

        if (error) {
            alert(error.message);
            return;
        }

        alert(`Studiepasset skickades till ${selectedStudentIdsToSend.length} elev(er).`);
        closeSendTemplate();
    }

    if (loading) {
        return (
            <main style={pageStyle(theme)}>
                <NavBar />
                <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                <p>Laddar förplanerade pass...</p>
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

            <h1>📚 Förplanerade pass</h1>
            <p style={{ color: "#94a3b8" }}>
                Skapa, organisera och skicka färdiga studiepass till elever.
            </p>

            <section style={cardStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "14px",
                        flexWrap: "wrap",
                    }}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>Kursmappar och studiepass</h2>
                        <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>
                            Skapa mappar för kurser och lägg dina färdiga pass där.
                        </p>

                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                marginTop: "14px",
                                flexWrap: "wrap",
                            }}
                        >
                            <input
                                value={newTemplateFolderName}
                                onChange={(event) => setNewTemplateFolderName(event.target.value)}
                                placeholder="Ny kursmapp..."
                                style={{
                                    ...inputStyle,
                                    maxWidth: "260px",
                                }}
                            />

                            <button onClick={createTemplateFolder} style={primaryButtonStyle}>
                                Skapa kursmapp
                            </button>
                        </div>
                    </div>

                    <button onClick={openNewTemplateEditor} style={primaryButtonStyle}>
                        + Skapa studiepass
                    </button>
                </div>

                {showTemplateEditor && (
                    <div style={templateEditorStyle}>
                        <h3 style={{ marginTop: 0 }}>
                            {selectedTemplate ? "Redigera studiepass" : "Skapa studiepass"}
                        </h3>

                        <div style={templateFormGridStyle}>
                            <input
                                value={templateTitle}
                                onChange={(event) => setTemplateTitle(event.target.value)}
                                placeholder="Titel, t.ex. Algebra grunder"
                                style={inputStyle}
                            />

                            <input
                                value={templateSubject}
                                onChange={(event) => setTemplateSubject(event.target.value)}
                                placeholder="Ämne, t.ex. Matematik"
                                style={inputStyle}
                            />

                            <input
                                value={templateArea}
                                onChange={(event) => setTemplateArea(event.target.value)}
                                placeholder="Område, t.ex. Ekvationer"
                                style={inputStyle}
                            />

                            <input
                                type="number"
                                min={1}
                                value={templateDuration}
                                onChange={(event) => setTemplateDuration(Number(event.target.value))}
                                placeholder="Minuter"
                                style={inputStyle}
                            />
                        </div>

                        <textarea
                            value={templatePlanning}
                            onChange={(event) => setTemplatePlanning(event.target.value)}
                            placeholder="Vad ska eleven göra under passet?"
                            rows={5}
                            style={{ ...inputStyle, marginTop: "12px", resize: "vertical" }}
                        />

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "10px",
                                marginTop: "14px",
                                flexWrap: "wrap",
                            }}
                        >
                            <button onClick={closeTemplateEditor} style={secondaryButtonStyle}>
                                Avbryt
                            </button>

                            <button onClick={saveStudyTemplate} style={primaryButtonStyle}>
                                Spara studiepass
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                    {templateFolders.map((folder) => {
                        const templatesInFolder = studyTemplates.filter(
                            (template) => template.folder_id === folder.id
                        );

                        const isOpen = openTemplateFolderIds.includes(folder.id);

                        return (
                            <div key={folder.id} style={templateFolderBoxStyle}>
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
                                        onClick={() => toggleTemplateFolderOpen(folder.id)}
                                        style={classFolderButtonStyle}
                                    >
                                        {isOpen ? "📂" : "📁"} {folder.name}
                                        <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
                                            ({templatesInFolder.length})
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => deleteTemplateFolder(folder.id)}
                                        style={dangerSmallButtonStyle}
                                    >
                                        Ta bort mapp
                                    </button>
                                </div>

                                {isOpen && (
                                    <div style={templateListStyle}>
                                        {templatesInFolder.length === 0 ? (
                                            <p style={{ color: "#94a3b8", margin: 0 }}>
                                                Inga pass i denna kursmapp ännu.
                                            </p>
                                        ) : (
                                            templatesInFolder.map((template) => (
                                                <TemplateCard
                                                    key={template.id}
                                                    template={template}
                                                    templateFolders={templateFolders}
                                                    assignTemplateToFolder={assignTemplateToFolder}
                                                    openSendTemplate={openSendTemplate}
                                                    deleteStudyTemplate={deleteStudyTemplate}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div style={templateFolderBoxStyle}>
                        <button
                            onClick={() => toggleTemplateFolderOpen("without-folder")}
                            style={classFolderButtonStyle}
                        >
                            {openTemplateFolderIds.includes("without-folder") ? "📂" : "📁"} Utan kursmapp
                            <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
                                ({studyTemplates.filter((template) => !template.folder_id).length})
                            </span>
                        </button>

                        {openTemplateFolderIds.includes("without-folder") && (
                            <div style={templateListStyle}>
                                {studyTemplates.filter((template) => !template.folder_id).length === 0 ? (
                                    <p style={{ color: "#94a3b8", margin: 0 }}>
                                        Inga pass utan kursmapp ännu.
                                    </p>
                                ) : (
                                    studyTemplates
                                        .filter((template) => !template.folder_id)
                                        .map((template) => (
                                            <TemplateCard
                                                key={template.id}
                                                template={template}
                                                templateFolders={templateFolders}
                                                assignTemplateToFolder={assignTemplateToFolder}
                                                openSendTemplate={openSendTemplate}
                                                deleteStudyTemplate={deleteStudyTemplate}
                                            />
                                        ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {templateToSend && (
                <SendTemplateModal
                    templateToSend={templateToSend}
                    adminClasses={adminClasses}
                    classStudents={classStudents}
                    profiles={profiles}
                    selectedStudentIdsToSend={selectedStudentIdsToSend}
                    openSendClassIds={openSendClassIds}
                    sendOtherUsersOpen={sendOtherUsersOpen}
                    closeSendTemplate={closeSendTemplate}
                    toggleSendClassOpen={toggleSendClassOpen}
                    toggleStudentForTemplate={toggleStudentForTemplate}
                    toggleAllStudentsInClass={toggleAllStudentsInClass}
                    toggleAllOtherUsers={toggleAllOtherUsers}
                    setSendOtherUsersOpen={setSendOtherUsersOpen}
                    sendTemplateToStudents={sendTemplateToStudents}
                    isStudentInAnyClass={isStudentInAnyClass}
                />
            )}
        </main>
    );
}

function TemplateCard({
    template,
    templateFolders,
    assignTemplateToFolder,
    openSendTemplate,
    deleteStudyTemplate,
}: {
    template: AdminStudyTemplate;
    templateFolders: AdminTemplateFolder[];
    assignTemplateToFolder: (templateId: string, folderId: string | null) => void;
    openSendTemplate: (template: AdminStudyTemplate) => void;
    deleteStudyTemplate: (templateId: string) => void;
}) {
    return (
        <article style={templateCardStyle}>
            <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: "17px" }}>{template.title}</strong>

                <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>
                    {template.subject}
                    {template.area ? ` · ${template.area}` : ""} · {template.duration} min
                </p>

                {template.planning && (
                    <p style={{ margin: "10px 0 0", color: "#cbd5e1" }}>
                        {template.planning.length > 120
                            ? `${template.planning.slice(0, 120)}...`
                            : template.planning}
                    </p>
                )}

                <select
                    value={template.folder_id || ""}
                    onChange={(event) =>
                        assignTemplateToFolder(template.id, event.target.value || null)
                    }
                    style={{ ...selectStyle, marginTop: "12px" }}
                >
                    <option value="">Utan kursmapp</option>

                    {templateFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                            {folder.name}
                        </option>
                    ))}
                </select>
            </div>

            <div style={templateButtonColumnStyle}>
                <button
                    onClick={() => {
                        window.location.href = `/admin/studiepass/${template.id}`;
                    }}
                    style={secondaryButtonStyle}
                >
                    Redigera pass
                </button>

                <button onClick={() => openSendTemplate(template)} style={primaryButtonStyle}>
                    Skicka
                </button>

                <button
                    onClick={() => deleteStudyTemplate(template.id)}
                    style={dangerSmallButtonStyle}
                >
                    Ta bort
                </button>
            </div>
        </article>
    );
}

function SendTemplateModal({
    templateToSend,
    adminClasses,
    classStudents,
    profiles,
    selectedStudentIdsToSend,
    openSendClassIds,
    sendOtherUsersOpen,
    closeSendTemplate,
    toggleSendClassOpen,
    toggleStudentForTemplate,
    toggleAllStudentsInClass,
    toggleAllOtherUsers,
    setSendOtherUsersOpen,
    sendTemplateToStudents,
    isStudentInAnyClass,
}: any) {
    return (
        <div
            onClick={closeSendTemplate}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.62)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 80,
                padding: "18px",
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: "620px",
                    maxWidth: "100%",
                    maxHeight: "82vh",
                    overflowY: "auto",
                    background: "#0f172a",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "22px",
                    padding: "22px",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "14px",
                        alignItems: "flex-start",
                    }}
                >
                    <div>
                        <h2 style={{ margin: 0 }}>Skicka studiepass</h2>
                        <p style={{ margin: "6px 0 0", color: "#94a3b8" }}>
                            {templateToSend.title} · {templateToSend.subject}
                            {templateToSend.area ? ` · ${templateToSend.area}` : ""}
                        </p>
                    </div>

                    <button onClick={closeSendTemplate} style={secondaryButtonStyle}>
                        ✕
                    </button>
                </div>

                <p style={{ color: "#cbd5e1", marginTop: "18px" }}>
                    Välj vilka elever som ska få passet.
                </p>

                <div style={{ display: "grid", gap: "12px" }}>
                    {adminClasses.map((adminClass: AdminClass) => {
                        const studentsInClassRows = classStudents.filter(
                            (row: AdminClassStudent) => row.class_id === adminClass.id
                        );

                        const studentIds = studentsInClassRows.map(
                            (row: AdminClassStudent) => row.student_id
                        );

                        const isOpen = openSendClassIds.includes(adminClass.id);

                        const allSelected =
                            studentIds.length > 0 &&
                            studentIds.every((studentId: string) =>
                                selectedStudentIdsToSend.includes(studentId)
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
                                        onClick={() => toggleSendClassOpen(adminClass.id)}
                                        style={classFolderButtonStyle}
                                    >
                                        {isOpen ? "📂" : "📁"} {adminClass.name}
                                        <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
                                            ({studentsInClassRows.length})
                                        </span>
                                    </button>

                                    {studentsInClassRows.length > 0 && (
                                        <button
                                            onClick={() => toggleAllStudentsInClass(studentIds)}
                                            style={secondaryButtonStyle}
                                        >
                                            {allSelected ? "Avmarkera alla" : "Markera alla"}
                                        </button>
                                    )}
                                </div>

                                {isOpen && (
                                    <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                                        {studentsInClassRows.length === 0 ? (
                                            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
                                                Inga elever i klassen.
                                            </p>
                                        ) : (
                                            studentsInClassRows.map((row: AdminClassStudent) => {
                                                const student = profiles.find(
                                                    (profile: Profile) => profile.id === row.student_id
                                                );

                                                const checked = selectedStudentIdsToSend.includes(row.student_id);

                                                return (
                                                    <StudentCheckbox
                                                        key={row.id}
                                                        checked={checked}
                                                        label={student?.username || "Okänd användare"}
                                                        onChange={() => toggleStudentForTemplate(row.student_id)}
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

                        const otherUserIds = otherUsers.map((profile: Profile) => profile.id);

                        const allOtherSelected =
                            otherUserIds.length > 0 &&
                            otherUserIds.every((studentId: string) =>
                                selectedStudentIdsToSend.includes(studentId)
                            );

                        return (
                            <div style={classBoxStyle}>
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
                                        onClick={() => setSendOtherUsersOpen((current: boolean) => !current)}
                                        style={classFolderButtonStyle}
                                    >
                                        {sendOtherUsersOpen ? "📂" : "📁"} Övriga användare
                                        <span style={{ color: "#94a3b8", marginLeft: "6px" }}>
                                            ({otherUsers.length})
                                        </span>
                                    </button>

                                    {otherUsers.length > 0 && (
                                        <button
                                            onClick={() => toggleAllOtherUsers(otherUserIds)}
                                            style={secondaryButtonStyle}
                                        >
                                            {allOtherSelected ? "Avmarkera alla" : "Markera alla"}
                                        </button>
                                    )}
                                </div>

                                {sendOtherUsersOpen && (
                                    <div style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                                        {otherUsers.length === 0 ? (
                                            <p style={{ color: "#94a3b8", marginBottom: 0 }}>
                                                Inga övriga användare.
                                            </p>
                                        ) : (
                                            otherUsers.map((student: Profile) => {
                                                const checked = selectedStudentIdsToSend.includes(student.id);

                                                return (
                                                    <StudentCheckbox
                                                        key={student.id}
                                                        checked={checked}
                                                        label={student.username || "Inget användarnamn"}
                                                        onChange={() => toggleStudentForTemplate(student.id)}
                                                    />
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                <div
                    style={{
                        position: "sticky",
                        bottom: "-22px",
                        margin: "18px -22px -22px",
                        padding: "14px 22px",
                        background: "rgba(15, 23, 42, 0.96)",
                        borderTop: "1px solid rgba(148, 163, 184, 0.22)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                    }}
                >
                    <span style={{ color: "#94a3b8", fontWeight: "bold" }}>
                        {selectedStudentIdsToSend.length} vald(a)
                    </span>

                    <button onClick={sendTemplateToStudents} style={primaryButtonStyle}>
                        Skicka till elever
                    </button>
                </div>
            </div>
        </div>
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

const pageStyle = (theme: typeof THEMES[ThemeKey]) => ({
    minHeight: "100vh",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    background: theme.background,
    color: theme.text,
});

const cardStyle = {
    marginTop: "24px",
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
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

const classBoxStyle = {
    padding: "12px",
    borderRadius: "14px",
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    marginBottom: "12px",
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

const templateEditorStyle = {
    marginTop: "18px",
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(30, 41, 59, 0.58)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
};

const templateFormGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "10px",
};

const templateListStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
    marginTop: "18px",
};

const templateCardStyle = {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(30, 41, 59, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
    flexWrap: "wrap" as const,
};

const templateButtonColumnStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    flexShrink: 0,
};

const templateFolderBoxStyle = {
    padding: "14px",
    borderRadius: "18px",
    background: "rgba(30, 41, 59, 0.55)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
};