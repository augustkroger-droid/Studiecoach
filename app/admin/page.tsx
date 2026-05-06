"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

type Profile = {
    id: string;
    username: string | null;
    is_admin?: boolean;
    created_at?: string;
};

type StudyPost = {
    id: string;
    user_id: string;
    subject: string;
    comment: string | null;
    date: string;
    created_at: string;
};

export default function AdminPage() {
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [posts, setPosts] = useState<StudyPost[]>([]);

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

        const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, is_admin, created_at")
            .order("created_at", { ascending: false });

        const { data: postData } = await supabase
            .from("study_posts")
            .select("id, user_id, subject, comment, date, created_at")
            .order("created_at", { ascending: false });

        setProfiles(profileData || []);
        setPosts(postData || []);
        setLoading(false);
    }

    function getUsername(userId: string) {
        return profiles.find((profile) => profile.id === userId)?.username || "Okänd användare";
    }

    if (loading) {
        return (
            <main style={pageStyle}>
                <NavBar />
                <p>Laddar admin...</p>
            </main>
        );
    }

    if (!allowed) {
        return (
            <main style={pageStyle}>
                <NavBar />
                <h1>Inte tillåtet</h1>
                <p>Du har inte behörighet att se denna sida.</p>
            </main>
        );
    }

    return (
        <main style={pageStyle}>
            <NavBar />

            <h1>🛠 Admin</h1>
            <p style={{ color: "#94a3b8" }}>
                Här kan du se nya användare och postade inlägg.
            </p>

            <section style={cardStyle}>
                <h2>Användare</h2>

                {profiles.map((profile) => (
                    <div key={profile.id} style={rowStyle}>
                        <div>
                            <strong>{profile.username || "Inget användarnamn"}</strong>
                            <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                                {profile.id}
                            </div>
                        </div>

                        {profile.is_admin && <strong>Admin</strong>}
                    </div>
                ))}
            </section>

            <section style={cardStyle}>
                <h2>Inlägg</h2>

                {posts.map((post) => (
                    <div key={post.id} style={rowStyle}>
                        <div>
                            <strong>{getUsername(post.user_id)}</strong>
                            <div>{post.subject}</div>

                            {post.comment && (
                                <p style={{ color: "#cbd5e1" }}>“{post.comment}”</p>
                            )}

                            <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                                {post.date}
                            </div>
                        </div>
                    </div>
                ))}
            </section>
        </main>
    );
}

const pageStyle = {
    minHeight: "100vh",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    background: "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
    color: "#e2e8f0",
};

const cardStyle = {
    marginTop: "24px",
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(15, 23, 42, 0.78)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
};

const rowStyle = {
    padding: "14px",
    borderRadius: "14px",
    background: "rgba(30, 41, 59, 0.7)",
    marginBottom: "10px",
};