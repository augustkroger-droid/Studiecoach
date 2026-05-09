"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import { supabase } from "@/lib/supabase";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

type Profile = {
    id: string;
    username: string;
    show_on_leaderboard?: boolean;
    is_admin?: boolean;
};

type FriendRequest = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: "pending" | "accepted";
};

type StudyPost = {
    id: string;
    user_id: string;
    study_session_id: string | null;
    subject: string;
    duration: number;
    date: string;
    comment: string | null;
    rating?: number | null;
    created_at: string;
    profiles?: {
        username: string;
    };
    post_type?: string;
    title?: string | null;
};

type Like = {
    id: string;
    post_id: string;
    user_id: string;
};

type PostComment = {
    id: string;
    post_id: string;
    user_id: string;
    comment: string;
    created_at: string;
};

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

function getStartOfWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    return monday;
}

function toDateString(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

export default function PeppPage() {
    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];
    const [userId, setUserId] = useState("");
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);

    const [posts, setPosts] = useState<StudyPost[]>([]);
    const [likes, setLikes] = useState<Like[]>([]);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [hoveredLikesPostId, setHoveredLikesPostId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

    const [searchUsername, setSearchUsername] = useState("");
    const [searchResults, setSearchResults] = useState<Profile[]>([]);

    const [goalHours, setGoalHours] = useState("");
    const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(0);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEverything();
    }, []);

    async function loadEverything() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        setUserId(user.id);

        const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, show_on_leaderboard, is_admin")
            .eq("id", user.id)
            .single();

        setMyProfile(profileData);
        setShowOnLeaderboard(profileData?.show_on_leaderboard ?? false);

        const isAdmin = profileData?.is_admin ?? false;

        const loadedFriendRequests = await loadFriendRequests(user.id);

        const acceptedIds = loadedFriendRequests
            .filter((request) => request.status === "accepted")
            .map((request) =>
                request.from_user_id === user.id
                    ? request.to_user_id
                    : request.from_user_id
            );

        const allowedUserIds = isAdmin ? null : [user.id, ...acceptedIds];

        const loadedPosts = await loadPosts(allowedUserIds);

        const profileIds = new Set<string>();

        profileIds.add(user.id);

        loadedFriendRequests.forEach((request) => {
            profileIds.add(request.from_user_id);
            profileIds.add(request.to_user_id);
        });

        loadedPosts.forEach((post) => {
            profileIds.add(post.user_id);
        });

        await Promise.all([
            loadProfiles(isAdmin, Array.from(profileIds)),
            loadLikes(),
            loadComments(),
            loadWeeklyGoal(user.id),
        ]);

        setLoading(false);
    }

    async function loadFriendRequests(currentUserId: string) {
        const { data, error } = await supabase
            .from("friend_requests")
            .select("*")
            .or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`);

        if (error) {
            alert(error.message);
            return [];
        }

        setFriendRequests(data || []);
        return data || [];
    }

    async function loadPosts(allowedUserIds: string[] | null) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        let query = supabase
            .from("study_posts")
            .select("*")
            .gte("date", oneWeekAgo.toISOString().split("T")[0])
            .order("created_at", { ascending: false });

        if (allowedUserIds) {
            query = query.in("user_id", allowedUserIds);
        }

        const { data, error } = await query;

        if (error) {
            alert(error.message);
            return [];
        }

        setPosts(data || []);
        return data || [];
    }

    async function loadProfiles(isAdmin: boolean, userIds: string[]) {
        const profileQuery = supabase
            .from("profiles")
            .select("id, username, show_on_leaderboard, is_admin");

        const { data, error } = isAdmin
            ? await profileQuery
            : await profileQuery.in("id", userIds);

        if (error) {
            alert(error.message);
            return;
        }

        setProfiles(data || []);
    }

    async function loadLikes() {
        const { data, error } = await supabase
            .from("post_likes")
            .select("*");

        if (error) {
            alert(error.message);
            return;
        }

        setLikes(data || []);
    }

    async function loadComments() {
        const { data, error } = await supabase
            .from("post_comments")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            alert(error.message);
            return;
        }

        setComments(data || []);
    }

    async function loadWeeklyGoal(currentUserId: string) {
        const weekStart = toDateString(getStartOfWeek());

        const { data } = await supabase
            .from("weekly_goals")
            .select("*")
            .eq("user_id", currentUserId)
            .eq("week_start", weekStart)
            .maybeSingle();

        if (data) {
            setWeeklyGoalMinutes(data.goal_minutes);
            setGoalHours(String(data.goal_minutes / 60));
        }
    }

    async function saveWeeklyGoal() {
        if (!goalHours) return;

        const weekStart = toDateString(getStartOfWeek());
        const minutes = Math.round(Number(goalHours) * 60);

        const { error } = await supabase
            .from("weekly_goals")
            .upsert({
                user_id: userId,
                week_start: weekStart,
                goal_minutes: minutes,
            }, {
                onConflict: "user_id,week_start",
            });

        if (error) {
            alert(error.message);
            return;
        }

        setWeeklyGoalMinutes(minutes);
    }

    async function searchUsers() {
        if (!searchUsername.trim()) return;

        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, show_on_leaderboard")
            .ilike("username", `%${searchUsername}%`)
            .neq("id", userId)
            .limit(10);

        if (error) {
            alert(error.message);
            return;
        }

        setSearchResults(data || []);
    }

    async function sendFriendRequest(toUserId: string) {
        const existingRequest = friendRequests.find(
            (request) =>
                (request.from_user_id === userId && request.to_user_id === toUserId) ||
                (request.from_user_id === toUserId && request.to_user_id === userId)
        );

        if (existingRequest) {
            if (existingRequest.status === "accepted") {
                alert("Ni är redan vänner.");
            } else {
                alert("Det finns redan en vänförfrågan mellan er.");
            }

            return;
        }

        const { error } = await supabase
            .from("friend_requests")
            .insert({
                from_user_id: userId,
                to_user_id: toUserId,
                status: "pending",
            });

        if (error) {
            alert(error.message);
            return;
        }

        alert("Vänförfrågan skickad!");
        setSearchResults([]);
        setSearchUsername("");
        loadEverything();
    }

    async function acceptFriendRequest(requestId: string) {
        const { error } = await supabase
            .from("friend_requests")
            .update({ status: "accepted" })
            .eq("id", requestId);

        if (error) {
            alert(error.message);
            return;
        }

        loadEverything();
    }

    async function toggleLike(postId: string) {
        const existingLike = likes.find(
            (like) => like.post_id === postId && like.user_id === userId
        );

        if (existingLike) {
            const { error } = await supabase
                .from("post_likes")
                .delete()
                .eq("id", existingLike.id);

            if (error) {
                alert(error.message);
                return;
            }
        } else {
            const { error } = await supabase
                .from("post_likes")
                .insert({
                    post_id: postId,
                    user_id: userId,
                });

            if (error) {
                alert(error.message);
                return;
            }
        }

        loadLikes();
    }

    async function addComment(postId: string) {
        const text = commentInputs[postId]?.trim();

        if (!text) return;

        const existingComment = comments.find(
            (comment) => comment.post_id === postId && comment.user_id === userId
        );

        if (existingComment) {
            alert("Du har redan kommenterat detta inlägg.");
            return;
        }

        const { error } = await supabase
            .from("post_comments")
            .insert({
                post_id: postId,
                user_id: userId,
                comment: text,
            });

        if (error) {
            alert(error.message);
            return;
        }

        setCommentInputs((current) => ({
            ...current,
            [postId]: "",
        }));

        loadComments();
    }

    async function deleteComment(commentId: string) {
        const confirmed = window.confirm("Ta bort kommentaren?");
        if (!confirmed) return;

        let query = supabase
            .from("post_comments")
            .delete()
            .eq("id", commentId);

        if (!myProfile?.is_admin) {
            query = query.eq("user_id", userId);
        }

        const { error } = await query;

        if (error) {
            alert(error.message);
            return;
        }

        loadComments();
    }

    async function toggleLeaderboardVisibility() {
        const nextValue = !showOnLeaderboard;

        const { error } = await supabase
            .from("profiles")
            .update({ show_on_leaderboard: nextValue })
            .eq("id", userId);

        if (error) {
            alert(error.message);
            return;
        }

        setShowOnLeaderboard(nextValue);
    }

    function getUsername(profileId: string) {
        if (profileId === myProfile?.id) return myProfile.username;
        return profiles.find((profile) => profile.id === profileId)?.username || "Okänd";
    }

    async function deletePost(postId: string) {
        const confirmed = window.confirm("Vill du ta bort detta inlägg?");
        if (!confirmed) return;

        let query = supabase
            .from("study_posts")
            .delete()
            .eq("id", postId);

        if (!myProfile?.is_admin) {
            query = query.eq("user_id", userId);
        }

        const { error } = await query;

        if (error) {
            alert(error.message);
            return;
        }

        loadEverything();
    }

    const acceptedFriendIds = Array.from(
        new Set(
            friendRequests
                .filter((request) => request.status === "accepted")
                .map((request) =>
                    request.from_user_id === userId
                        ? request.to_user_id
                        : request.from_user_id
                )
        )
    );

    const pendingIncomingRequests = friendRequests.filter(
        (request) => request.status === "pending" && request.to_user_id === userId
    );

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const postsLastWeek = posts.filter((post) => {
        const postDate = new Date(post.date);
        return postDate >= oneWeekAgo;
    });

    const leaderboardMap: Record<string, number> = {};

    postsLastWeek.forEach((post) => {
        leaderboardMap[post.user_id] =
            (leaderboardMap[post.user_id] || 0) + post.duration;
    });

    const fullLeaderboard = Object.entries(leaderboardMap).sort(
        (a, b) => b[1] - a[1]
    );

    const leaderboard = fullLeaderboard
        .filter(([id]) => {
            if (id === userId) return showOnLeaderboard;

            const profile = profiles.find((profile) => profile.id === id);
            return profile?.show_on_leaderboard ?? false;
        })
        .slice(0, 3);

    const myLeaderboardIndex = fullLeaderboard.findIndex(([id]) => id === userId);

    const myLeaderboardMinutes =
        myLeaderboardIndex === -1 ? 0 : fullLeaderboard[myLeaderboardIndex][1];

    const myWeekMinutes = postsLastWeek
        .filter((post) => post.user_id === userId)
        .reduce((sum, post) => sum + post.duration, 0);

    const goalPercent =
        weeklyGoalMinutes === 0
            ? 0
            : Math.min(100, Math.round((myWeekMinutes / weeklyGoalMinutes) * 100));

    if (loading) {
        return (
            <main style={pageStyle(theme)}>
                <NavBar />
                <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
                <p>Laddar pepp...</p>
            </main>
        );
    }

    return (
        <main style={pageStyle(theme)}>
            <NavBar />
            <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />

            <h1 style={{ fontSize: "36px", marginBottom: "4px" }}>🔥 Pepp</h1>
            <p style={{ marginTop: 0, color: "#94a3b8" }}>
                Peppa dina vänner och följ deras postade studiepass.
            </p>

            <section className="pepp-layout" style={layoutStyle}>
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    <section style={cardStyle(theme)}>
                        <h2 style={{ marginTop: 0 }}>Flöde</h2>

                        {posts.length === 0 ? (
                            <p style={{ color: "#94a3b8" }}>
                                Inga postade studiepass senaste veckan.
                            </p>
                        ) : (
                            posts.map((post) => {
                                const postLikes = likes.filter((like) => like.post_id === post.id);
                                const likedByMe = postLikes.some((like) => like.user_id === userId);

                                return (
                                    <article
                                        key={post.id}
                                        style={{
                                            ...postCardStyle,
                                            position: "relative",
                                        }}
                                    >
                                        {(post.user_id === userId || myProfile?.is_admin) && (
                                            <button
                                                onClick={() => deletePost(post.id)}
                                                style={{
                                                    position: "absolute",
                                                    top: "18px",
                                                    right: "18px",
                                                    width: "34px",
                                                    height: "34px",
                                                    borderRadius: "999px",
                                                    border: "1px solid rgba(248, 113, 113, 0.45)",
                                                    background: "rgba(239, 68, 68, 0.12)",
                                                    color: "#fecaca",
                                                    cursor: "pointer",
                                                    fontWeight: "bold",
                                                    fontSize: "18px",
                                                }}
                                                title="Ta bort inlägg"
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                                            <div>
                                                <h3 style={{ margin: 0 }}>
                                                    {getUsername(post.user_id)}
                                                </h3>

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

                                                <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "14px" }}>
                                                    {formatDate(post.date)}
                                                </p>
                                            </div>
                                        </div>

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
                                        <div
                                            className="pepp-post-actions"
                                            style={{
                                                marginTop: "18px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <button
                                                onClick={() =>
                                                    setOpenCommentsPostId(
                                                        openCommentsPostId === post.id ? null : post.id
                                                    )
                                                }
                                                style={{
                                                    height: "42px",
                                                    padding: "0 16px",
                                                    borderRadius: "999px",
                                                    background:
                                                        openCommentsPostId === post.id
                                                            ? "rgba(37, 99, 235, 0.2)"
                                                            : "rgba(15, 23, 42, 0.75)",
                                                    color: "#e2e8f0",
                                                    border:
                                                        openCommentsPostId === post.id
                                                            ? "1px solid rgba(96, 165, 250, 0.45)"
                                                            : "1px solid rgba(148, 163, 184, 0.24)",
                                                    cursor: "pointer",
                                                    fontWeight: "bold",
                                                    transition: "0.2s ease",
                                                }}
                                            >
                                                💬 Kommentarer{" "}
                                                {comments.filter((comment) => comment.post_id === post.id).length}
                                            </button>

                                            <div
                                                style={{ position: "relative" }}
                                                onMouseEnter={() => setHoveredLikesPostId(post.id)}
                                                onMouseLeave={() => setHoveredLikesPostId(null)}
                                            >
                                                <button
                                                    onClick={() => toggleLike(post.id)}
                                                    style={{
                                                        height: "44px",
                                                        minWidth: "72px",
                                                        padding: "0 16px",
                                                        borderRadius: "999px",
                                                        background: likedByMe
                                                            ? "rgba(239, 68, 68, 0.16)"
                                                            : "rgba(15, 23, 42, 0.72)",
                                                        color: likedByMe ? "#fecaca" : "#ffffff",
                                                        border: likedByMe
                                                            ? "1px solid rgba(248, 113, 113, 0.42)"
                                                            : "1px solid rgba(148, 163, 184, 0.22)",
                                                        cursor: "pointer",
                                                        fontWeight: "bold",
                                                        fontSize: "16px",
                                                        boxShadow: likedByMe
                                                            ? "0 0 20px rgba(239,68,68,0.12)"
                                                            : "none",
                                                        transition: "0.2s ease",
                                                    }}
                                                >
                                                    ❤️ {postLikes.length}
                                                </button>

                                                {hoveredLikesPostId === post.id && postLikes.length > 0 && (
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            top: "54px",
                                                            right: 0,
                                                            minWidth: "190px",
                                                            maxWidth: "240px",
                                                            padding: "12px",
                                                            borderRadius: "16px",
                                                            background: "rgba(15, 23, 42, 0.96)",
                                                            border: "1px solid rgba(148, 163, 184, 0.2)",
                                                            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
                                                            backdropFilter: "blur(10px)",
                                                            zIndex: 20,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                fontSize: "13px",
                                                                color: "#94a3b8",
                                                                marginBottom: "8px",
                                                                fontWeight: "bold",
                                                            }}
                                                        >
                                                            Gillat av
                                                        </div>

                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                gap: "8px",
                                                            }}
                                                        >
                                                            {postLikes.map((like) => (
                                                                <div
                                                                    key={like.id}
                                                                    style={{
                                                                        padding: "8px 10px",
                                                                        borderRadius: "10px",
                                                                        background: "rgba(30, 41, 59, 0.72)",
                                                                        color: "#e2e8f0",
                                                                        fontWeight: "bold",
                                                                        fontSize: "14px",
                                                                    }}
                                                                >
                                                                    {getUsername(like.user_id)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {openCommentsPostId === post.id && (() => {
                                            const postComments = comments.filter(
                                                (comment) => comment.post_id === post.id
                                            );

                                            const myComment = postComments.find(
                                                (comment) => comment.user_id === userId
                                            );

                                            return (
                                                <div
                                                    style={{
                                                        marginTop: "18px",
                                                        paddingTop: "18px",
                                                        borderTop: "1px solid rgba(148, 163, 184, 0.16)",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "12px",
                                                    }}
                                                >
                                                    {postComments.length === 0 ? (
                                                        <p
                                                            style={{
                                                                margin: 0,
                                                                color: "#94a3b8",
                                                                fontSize: "14px",
                                                            }}
                                                        >
                                                            Inga kommentarer ännu.
                                                        </p>
                                                    ) : (
                                                        postComments.map((comment) => (
                                                            <div
                                                                key={comment.id}
                                                                style={{
                                                                    padding: "12px 14px",
                                                                    borderRadius: "14px",
                                                                    background: "rgba(15, 23, 42, 0.72)",
                                                                    border:
                                                                        "1px solid rgba(148, 163, 184, 0.14)",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        justifyContent: "space-between",
                                                                        alignItems: "flex-start",
                                                                        gap: "12px",
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <strong
                                                                            style={{
                                                                                fontSize: "14px",
                                                                            }}
                                                                        >
                                                                            {getUsername(comment.user_id)}
                                                                        </strong>

                                                                        <p
                                                                            style={{
                                                                                margin: "6px 0 0",
                                                                                color: "#e2e8f0",
                                                                                lineHeight: 1.45,
                                                                            }}
                                                                        >
                                                                            {comment.comment}
                                                                        </p>
                                                                    </div>

                                                                    {(comment.user_id === userId || myProfile?.is_admin) && (
                                                                        <button
                                                                            onClick={() =>
                                                                                deleteComment(comment.id)
                                                                            }
                                                                            style={{
                                                                                border: "none",
                                                                                background: "transparent",
                                                                                color: "#fca5a5",
                                                                                cursor: "pointer",
                                                                                fontWeight: "bold",
                                                                                fontSize: "13px",
                                                                            }}
                                                                        >
                                                                            Ta bort
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}

                                                    {!myComment && (
                                                        <div
                                                            className="pepp-comment-form"
                                                            style={{
                                                                display: "flex",
                                                                gap: "10px",
                                                                marginTop: "4px",
                                                            }}
                                                        >
                                                            <input
                                                                placeholder="Skriv en kommentar..."
                                                                value={commentInputs[post.id] || ""}
                                                                onChange={(e) =>
                                                                    setCommentInputs((current) => ({
                                                                        ...current,
                                                                        [post.id]: e.target.value,
                                                                    }))
                                                                }
                                                                style={{
                                                                    ...inputStyle,
                                                                    background: "rgba(15, 23, 42, 0.72)",
                                                                }}
                                                            />

                                                            <button
                                                                onClick={() => addComment(post.id)}
                                                                style={{
                                                                    ...smallButtonStyle(theme),
                                                                    padding: "0 18px",
                                                                    borderRadius: "12px",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                Skicka
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </article>
                                );
                            })
                        )}
                    </section>
                </div>

                <aside style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    <section style={cardStyle(theme)}>
                        <h2 style={{ marginTop: 0 }}>🏆 Veckans topp 3</h2>


                        {leaderboard.length === 0 ? (
                            <p style={{ color: "#94a3b8" }}>Ingen har postat pass senaste veckan.</p>
                        ) : (
                            leaderboard.map(([id, minutes], index) => (
                                <div key={id} style={leaderboardRowStyle}>
                                    <strong>
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} {getUsername(id)}
                                    </strong>
                                    <span>{formatHours(minutes)}</span>
                                </div>
                            ))

                        )}
                        {myLeaderboardIndex !== -1 && (
                            <div
                                style={{
                                    marginTop: "12px",
                                    padding: "12px",
                                    borderRadius: "12px",
                                    background: "rgba(37, 99, 235, 0.14)",
                                    border: "1px solid rgba(96, 165, 250, 0.35)",
                                }}
                            >
                                <strong>Din placering: #{myLeaderboardIndex + 1}</strong>

                                <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                                    {formatHours(myLeaderboardMinutes)}
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
                                        fontSize: "14px",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={showOnLeaderboard}
                                        onChange={toggleLeaderboardVisibility}
                                        style={{
                                            width: "16px",
                                            height: "16px",
                                            cursor: "pointer",
                                        }}
                                    />

                                    Delta i topplistan
                                </label>
                            </div>
                        )}
                    </section>

                    <section style={cardStyle(theme)}>
                        <h2 style={{ marginTop: 0 }}>👥 Vänner</h2>

                        <div className="pepp-friend-search" style={{ display: "flex", gap: "8px" }}>
                            <input
                                placeholder="Sök användarnamn"
                                value={searchUsername}
                                onChange={(e) => setSearchUsername(e.target.value)}
                                style={inputStyle}
                            />

                            <button onClick={searchUsers} style={primaryButtonStyle(theme)}>
                                Sök
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                {searchResults.map((profile) => (
                                    <div key={profile.id} style={friendRowStyle}>
                                        <strong>{profile.username}</strong>
                                        {acceptedFriendIds.includes(profile.id) ? (
                                            <span style={{ color: "#94a3b8", fontWeight: "bold" }}>
                                                Redan vän
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => sendFriendRequest(profile.id)}
                                                style={smallButtonStyle(theme)}
                                            >
                                                Lägg till
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {pendingIncomingRequests.length > 0 && (
                            <>
                                <h3>Förfrågningar</h3>

                                {pendingIncomingRequests.map((request) => (
                                    <div key={request.id} style={friendRowStyle}>
                                        <strong>{getUsername(request.from_user_id)}</strong>
                                        <button
                                            onClick={() => acceptFriendRequest(request.id)}
                                            style={smallButtonStyle(theme)}
                                        >
                                            Acceptera
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}

                        <h3>Dina vänner</h3>

                        {acceptedFriendIds.length === 0 ? (
                            <p style={{ color: "#94a3b8" }}>Du har inga vänner ännu.</p>
                        ) : (
                            acceptedFriendIds.map((friendId) => (
                                <div key={friendId} style={friendRowStyle}>
                                    <strong>{getUsername(friendId)}</strong>
                                </div>
                            ))
                        )}
                    </section>
                </aside>
            </section>
        </main>
    );
}

const pageStyle = (theme: typeof THEMES[ThemeKey]) => ({
    minHeight: "100vh",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    background: theme.background,
    color: theme.text,
});

const layoutStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: "20px",
    alignItems: "start",
};

const cardStyle = (theme: typeof THEMES[ThemeKey]) => ({
    padding: "22px",
    borderRadius: "20px",
    background: theme.card,
    border: `1px solid ${theme.border}`,
    boxShadow: "0 18px 40px rgba(0,0,0,0.32)",
});

const postCardStyle = {
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(30, 41, 59, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    marginBottom: "14px",
};

const inputStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    background: "rgba(2, 6, 23, 0.75)",
    color: "white",
    boxSizing: "border-box" as const,
};

const primaryButtonStyle = (theme: typeof THEMES[ThemeKey]) => ({
    padding: "12px 14px",
    borderRadius: "12px",
    border: `1px solid ${theme.border}`,
    background: "rgba(255,255,255,0.14)",
    color: theme.text,
    fontWeight: "bold",
    cursor: "pointer",
});

const smallButtonStyle = (theme: typeof THEMES[ThemeKey]) => ({
    padding: "8px 10px",
    borderRadius: "10px",
    border: `1px solid ${theme.border}`,
    background: "rgba(255,255,255,0.14)",
    color: theme.text,
    fontWeight: "bold",
    cursor: "pointer",
});

const friendRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "10px",
    borderRadius: "12px",
    background: "rgba(15, 23, 42, 0.72)",
};

const leaderboardRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(15, 23, 42, 0.72)",
    marginBottom: "8px",
};

const barOuterStyle = {
    height: "14px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "rgba(148, 163, 184, 0.22)",
};

const barInnerStyle = {
    height: "100%",
    borderRadius: "999px",
    background: "#2563eb",
};