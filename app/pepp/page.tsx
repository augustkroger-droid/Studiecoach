"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { supabase } from "@/lib/supabase";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

type Profile = {
    id: string;
    username: string;
    show_on_leaderboard?: boolean;
    show_on_global_leaderboard?: boolean;
    hide_leaderboard?: boolean;
    hide_global_leaderboard?: boolean;
    is_admin?: boolean;
    role?: "student" | "teacher" | "admin" | null;
};

type TeacherStudentAccess = {
    id: string;
    teacher_id: string;
    student_id: string;
    created_at: string;
};

type FriendRequest = {
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: "pending" | "accepted";
};

type StudySession = {
    id: string;
    user_id: string;
    subject: string;
    duration: number;
    date: string;
    status?: "planned" | "active" | "paused" | "done" | "missed";
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

type Reaction = "❤️" | "🔥" | "👏" | "💪" | "🎉" | "🤯" | "😢";

type Like = {
    id: string;
    post_id: string;
    user_id: string;
    reaction: Reaction;
};

const REACTIONS: Reaction[] = ["❤️", "🔥", "👏", "💪", "🎉", "🤯", "😢"];

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

function getEndOfWeek() {
    const monday = getStartOfWeek();
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    return nextMonday;
}

function toDateString(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

export default function PeppPage() {
    return (
        <Suspense fallback={null}>
            <PeppPageContent />
        </Suspense>
    );
}

function PeppPageContent() {
    const searchParams = useSearchParams();
    const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

    useEffect(() => {
        setThemeKey(getSavedTheme());
    }, []);

    const theme = THEMES[themeKey];
    const [userId, setUserId] = useState("");
    const [myProfile, setMyProfile] = useState<Profile | null>(null);
    const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
    const [showOnGlobalLeaderboard, setShowOnGlobalLeaderboard] = useState(true);
    const [hideLeaderboard, setHideLeaderboard] = useState(false);
    const [hideGlobalLeaderboard, setHideGlobalLeaderboard] = useState(false);

    const [posts, setPosts] = useState<StudyPost[]>([]);
    const [likes, setLikes] = useState<Like[]>([]);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [hoveredLikesPostId, setHoveredLikesPostId] = useState<string | null>(null);
    const [hoveredReactionKey, setHoveredReactionKey] = useState<string | null>(null);
    const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [weeklySessions, setWeeklySessions] = useState<StudySession[]>([]);
    const [globalWeeklySessions, setGlobalWeeklySessions] = useState<StudySession[]>([]);
    const [globalProfiles, setGlobalProfiles] = useState<Profile[]>([]);

    const [searchUsername, setSearchUsername] = useState("");
    const [searchResults, setSearchResults] = useState<Profile[]>([]);

    const [goalHours, setGoalHours] = useState("");
    const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(0);

    const [loading, setLoading] = useState(true);

    const [teacherStudentIds, setTeacherStudentIds] = useState<string[]>([]);

    useEffect(() => {
        loadEverything();
    }, []);

    useEffect(() => {
        const postId = searchParams.get("post");

        if (!postId || loading) return;

        setHighlightedPostId(postId);

        setTimeout(() => {
            const element = document.getElementById(`pepp-post-${postId}`);

            if (element) {
                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }
        }, 300);

        const timeout = setTimeout(() => {
            setHighlightedPostId(null);
        }, 3500);

        return () => clearTimeout(timeout);
    }, [searchParams, loading]);

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
            .select("id, username, show_on_leaderboard, show_on_global_leaderboard, hide_leaderboard, hide_global_leaderboard, is_admin, role")
            .eq("id", user.id)
            .single();

        setMyProfile(profileData);
        setShowOnLeaderboard(profileData?.show_on_leaderboard ?? false);
        setShowOnGlobalLeaderboard(profileData?.show_on_global_leaderboard ?? true);
        setHideLeaderboard(profileData?.hide_leaderboard ?? false);
        setHideGlobalLeaderboard(profileData?.hide_global_leaderboard ?? false);

        const isAdmin = profileData?.is_admin === true || profileData?.role === "admin";
        const isTeacher = profileData?.role === "teacher" || isAdmin;

        const loadedFriendRequests = await loadFriendRequests(user.id);

        const acceptedIds = loadedFriendRequests
            .filter((request) => request.status === "accepted")
            .map((request) =>
                request.from_user_id === user.id
                    ? request.to_user_id
                    : request.from_user_id
            );

        let loadedTeacherStudentIds: string[] = [];

        if (isTeacher && !isAdmin) {
            const { data: teacherStudentData, error: teacherStudentError } = await supabase
                .from("teacher_students")
                .select("student_id")
                .eq("teacher_id", user.id);

            if (teacherStudentError) {
                alert(teacherStudentError.message);
            }

            loadedTeacherStudentIds = (teacherStudentData || []).map(
                (row: Pick<TeacherStudentAccess, "student_id">) => row.student_id
            );
        }

        const allowedUserIds = isAdmin
            ? null
            : Array.from(new Set([user.id, ...acceptedIds, ...loadedTeacherStudentIds]));

        const loadedPosts = await loadPosts(allowedUserIds);
        const loadedWeeklySessions = await loadWeeklySessions(allowedUserIds);
        const loadedGlobalWeeklySessions = await loadGlobalWeeklySessions();

        const loadedGlobalPosts = await loadGlobalWeeklyPosts();

        const globalProfileIds = Array.from(
            new Set([
                ...loadedGlobalPosts.map((post) => post.user_id),
                ...loadedGlobalWeeklySessions.map((session) => session.user_id),
            ])
        );

        await loadGlobalProfiles(globalProfileIds);

        const profileIds = new Set<string>();

        profileIds.add(user.id);

        loadedFriendRequests.forEach((request) => {
            profileIds.add(request.from_user_id);
            profileIds.add(request.to_user_id);
        });

        loadedPosts.forEach((post) => {
            profileIds.add(post.user_id);
        });

        loadedWeeklySessions.forEach((session) => {
            profileIds.add(session.user_id);
        });

        const visiblePostIds = loadedPosts.map((post) => post.id);

        if (visiblePostIds.length > 0) {
            const { data: reactionData } = await supabase
                .from("post_likes")
                .select("user_id")
                .in("post_id", visiblePostIds);

            reactionData?.forEach((reaction) => {
                profileIds.add(reaction.user_id);
            });

            const { data: commentData } = await supabase
                .from("post_comments")
                .select("user_id")
                .in("post_id", visiblePostIds);

            commentData?.forEach((comment) => {
                profileIds.add(comment.user_id);
            });
        }

        loadedTeacherStudentIds.forEach((studentId) => {
            profileIds.add(studentId);
        });

        await Promise.all([
            loadProfiles(isAdmin, Array.from(profileIds)),
            loadLikes(visiblePostIds),
            loadComments(),
            loadWeeklyGoal(user.id),
        ]);

        setTeacherStudentIds(loadedTeacherStudentIds);
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
        const weekStart = toDateString(getStartOfWeek());
        const weekEnd = toDateString(getEndOfWeek());

        let query = supabase
            .from("study_posts")
            .select("*")
            .gte("date", weekStart)
            .lt("date", weekEnd)
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

    async function loadWeeklySessions(allowedUserIds: string[] | null) {
        const weekStart = toDateString(getStartOfWeek());
        const weekEnd = toDateString(getEndOfWeek());

        let query = supabase
            .from("study_sessions")
            .select("id, user_id, subject, duration, date, status")
            .gte("date", weekStart)
            .lt("date", weekEnd)
            .eq("status", "done")
            .gt("duration", 0);

        if (allowedUserIds) {
            query = query.in("user_id", allowedUserIds);
        }

        const { data, error } = await query;

        if (error) {
            alert(error.message);
            return [];
        }

        setWeeklySessions(data || []);
        return data || [];
    }

    async function loadGlobalWeeklySessions() {
        const weekStart = toDateString(getStartOfWeek());
        const weekEnd = toDateString(getEndOfWeek());

        const { data, error } = await supabase
            .from("study_sessions")
            .select("id, user_id, subject, duration, date, status")
            .gte("date", weekStart)
            .lt("date", weekEnd)
            .eq("status", "done")
            .gt("duration", 0);

        if (error) {
            alert(error.message);
            return [];
        }

        setGlobalWeeklySessions(data || []);
        return data || [];
    }

    async function loadGlobalWeeklyPosts() {
        const weekStart = toDateString(getStartOfWeek());
        const weekEnd = toDateString(getEndOfWeek());

        const { data, error } = await supabase
            .from("study_posts")
            .select("*")
            .gte("date", weekStart)
            .lt("date", weekEnd)

        if (error) {
            alert(error.message);
            return [];
        }

        return data || [];
    }

    async function loadGlobalProfiles(userIds: string[]) {
        if (userIds.length === 0) {
            setGlobalProfiles([]);
            return;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, show_on_leaderboard, hide_leaderboard, is_admin, role")
            .in("id", userIds);

        if (error) {
            alert(error.message);
            return;
        }

        setGlobalProfiles(data || []);
    }

    async function loadProfiles(isAdmin: boolean, userIds: string[]) {
        const profileQuery = supabase
            .from("profiles")
            .select("id, username, show_on_leaderboard, hide_leaderboard, is_admin, role")

        const { data, error } = isAdmin
            ? await profileQuery
            : await profileQuery.in("id", userIds);

        if (error) {
            alert(error.message);
            return;
        }

        setProfiles(data || []);
    }

    async function loadLikes(postIds: string[]) {
        if (postIds.length === 0) {
            setLikes([]);
            return;
        }

        const { data, error } = await supabase
            .from("post_likes")
            .select("*")
            .in("post_id", postIds);

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
            .select("id, username, show_on_leaderboard, show_on_global_leaderboard")
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

    async function removeFriend(friendId: string) {
        const confirmed = window.confirm(
            `Är du säker på att du vill ta bort ${getUsername(friendId)} som vän? Ni kommer inte längre se varandras inlägg.`
        );

        if (!confirmed) return;

        const { data, error } = await supabase
            .from("friend_requests")
            .delete()
            .or(
                `and(from_user_id.eq.${userId},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${userId})`
            )
            .eq("status", "accepted")
            .select();

        if (error) {
            alert(error.message);
            return;
        }

        if (!data || data.length === 0) {
            alert("Kunde inte ta bort vännen.");
            return;
        }

        setFriendRequests((current) =>
            current.filter(
                (request) =>
                    !(
                        request.status === "accepted" &&
                        (
                            (request.from_user_id === userId && request.to_user_id === friendId) ||
                            (request.from_user_id === friendId && request.to_user_id === userId)
                        )
                    )
            )
        );

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

    async function toggleReaction(postId: string, reaction: Reaction) {
        const existingReaction = likes.find(
            (like) => like.post_id === postId && like.user_id === userId
        );

        if (existingReaction?.reaction === reaction) {
            const { error } = await supabase
                .from("post_likes")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", userId);

            if (error) {
                alert(error.message);
                return;
            }

            setLikes((current) =>
                current.filter(
                    (like) => !(like.post_id === postId && like.user_id === userId)
                )
            );

            return;
        }

        const { data, error } = await supabase
            .from("post_likes")
            .upsert(
                {
                    post_id: postId,
                    user_id: userId,
                    reaction,
                },
                {
                    onConflict: "post_id,user_id",
                }
            )
            .select()
            .single();

        if (error) {
            console.error("Kunde inte spara reaktion:", error);
            alert(error.message);
            return;
        }

        console.log("Sparad reaktion:", data);

        setLikes((current) => {
            const withoutOld = current.filter(
                (like) => !(like.post_id === postId && like.user_id === userId)
            );

            return [...withoutOld, data];
        });

        if (!existingReaction) {
            const post = posts.find((post) => post.id === postId);

            if (post) {
                await createNotification({
                    postId,
                    postOwnerId: post.user_id,
                    type: "like",
                });
            }
        }
    }

    async function addComment(postId: string) {
        const text = commentInputs[postId]?.trim();

        if (!text) return;

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

        const post = posts.find((post) => post.id === postId);

        if (post) {
            await createNotification({
                postId,
                postOwnerId: post.user_id,
                type: "comment",
            });
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

    async function toggleGlobalLeaderboardVisibility() {
        const nextValue = !showOnGlobalLeaderboard;

        const { error } = await supabase
            .from("profiles")
            .update({ show_on_global_leaderboard: nextValue })
            .eq("id", userId);

        if (error) {
            alert(error.message);
            return;
        }

        setShowOnGlobalLeaderboard(nextValue);
    }

    async function toggleHideGlobalLeaderboard() {
        const nextValue = !hideGlobalLeaderboard;

        const { error } = await supabase
            .from("profiles")
            .update({ hide_global_leaderboard: nextValue })
            .eq("id", userId);

        if (error) {
            alert(error.message);
            return;
        }

        setHideGlobalLeaderboard(nextValue);
    }

    async function toggleHideLeaderboard() {
        const nextValue = !hideLeaderboard;

        const { error } = await supabase
            .from("profiles")
            .update({ hide_leaderboard: nextValue })
            .eq("id", userId);

        if (error) {
            alert(error.message);
            return;
        }

        setHideLeaderboard(nextValue);
    }

    async function createNotification({
        postId,
        postOwnerId,
        type,
    }: {
        postId: string;
        postOwnerId: string;
        type: "like" | "comment";
    }) {
        if (!userId) return;
        if (postOwnerId === userId) return;

        const actorName = myProfile?.username || "Någon";

        const message =
            type === "like"
                ? `${actorName} har reagerat på ditt studiepass`
                : `${actorName} har kommenterat på ditt studiepass`;

        const { error } = await supabase
            .from("notifications")
            .insert({
                user_id: postOwnerId,
                actor_id: userId,
                post_id: postId,
                type,
                message,
            });

        if (error) {
            console.error(error.message);
        }
    }

    function getUsername(profileId: string) {
        if (profileId === myProfile?.id) return myProfile.username;
        return profiles.find((profile) => profile.id === profileId)?.username || "Okänd";
    }

    async function deletePost(postId: string) {
        const confirmed = window.confirm("Vill du ta bort detta inlägg?");
        if (!confirmed) return;

        const postToDelete = posts.find((post) => post.id === postId);

        if (!postToDelete) {
            alert("Kunde inte hitta inlägget.");
            return;
        }

        const canDelete =
            postToDelete.user_id === userId ||
            myProfile?.is_admin ||
            teacherStudentIds.includes(postToDelete.user_id);

        if (!canDelete) {
            alert("Du har inte behörighet att ta bort detta inlägg.");
            return;
        }

        const { error } = await supabase
            .from("study_posts")
            .delete()
            .eq("id", postId);

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

    const weekStart = toDateString(getStartOfWeek());

    const postsThisWeek = posts.filter((post) => {
        return post.date >= weekStart;
    });

    const friendLeaderboardMap: Record<string, number> = {};

    weeklySessions.forEach((session) => {
        friendLeaderboardMap[session.user_id] =
            (friendLeaderboardMap[session.user_id] || 0) + session.duration;
    });

    const fullFriendLeaderboard = Object.entries(friendLeaderboardMap).sort(
        (a, b) => b[1] - a[1]
    );

    const friendLeaderboard = fullFriendLeaderboard
        .filter(([id]) => {
            if (id === userId) return showOnLeaderboard;

            const profile = profiles.find((profile) => profile.id === id);
            return profile?.show_on_leaderboard ?? false;
        })
        .slice(0, 3);

    const globalLeaderboardMap: Record<string, number> = {};

    globalWeeklySessions.forEach((session) => {
        globalLeaderboardMap[session.user_id] =
            (globalLeaderboardMap[session.user_id] || 0) + session.duration;
    });

    const fullGlobalLeaderboard = Object.entries(globalLeaderboardMap).sort(
        (a, b) => b[1] - a[1]
    );

    const globalLeaderboard = fullGlobalLeaderboard
        .filter(([id]) => {
            if (id === userId) return showOnGlobalLeaderboard;

            const profile = globalProfiles.find((profile) => profile.id === id);
            return profile?.show_on_global_leaderboard ?? true;
        })
        .slice(0, 5);

    const myFriendLeaderboardIndex = fullFriendLeaderboard.findIndex(([id]) => id === userId);

    const myFriendLeaderboardMinutes =
        myFriendLeaderboardIndex === -1 ? 0 : fullFriendLeaderboard[myFriendLeaderboardIndex][1];

    const myGlobalLeaderboardIndex = fullGlobalLeaderboard.findIndex(([id]) => id === userId);

    const myGlobalLeaderboardMinutes =
        myGlobalLeaderboardIndex === -1 ? 0 : fullGlobalLeaderboard[myGlobalLeaderboardIndex][1];

    const myWeekMinutes = weeklySessions
        .filter((session) => session.user_id === userId)
        .reduce((sum, session) => sum + session.duration, 0);

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
                                const postReactions = likes.filter((like) => like.post_id === post.id);

                                const myReaction = postReactions.find(
                                    (like) => like.user_id === userId
                                );

                                const reactionCounts = REACTIONS.map((reaction) => ({
                                    reaction,
                                    count: postReactions.filter((like) => like.reaction === reaction).length,
                                })).filter((item) => item.count > 0);

                                return (
                                    <article
                                        id={`pepp-post-${post.id}`}
                                        className={highlightedPostId === post.id ? "pepp-highlight-post" : ""}
                                        key={post.id}
                                        style={{
                                            ...postCardStyle,
                                            position: "relative",
                                            transition: "box-shadow 0.3s ease, outline 0.3s ease",
                                        }}
                                    >
                                        {(post.user_id === userId ||
                                            myProfile?.is_admin ||
                                            teacherStudentIds.includes(post.user_id)) && (
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
                                                style={{
                                                    position: "relative",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "flex-end",
                                                }}
                                                onMouseEnter={(e) => {
                                                    const target = e.target as HTMLElement;

                                                    if (!target.closest("[data-reaction-pill]")) {
                                                        setHoveredReactionKey(null);
                                                        setHoveredLikesPostId(post.id);
                                                    }
                                                }}
                                                onMouseLeave={() => setHoveredLikesPostId(null)}
                                            >
                                                <div style={{ position: "relative" }}>
                                                    {hoveredLikesPostId === post.id && !hoveredReactionKey && (
                                                        <>
                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    right: 0,
                                                                    bottom: "46px",
                                                                    width: "230px",
                                                                    height: "14px",
                                                                    zIndex: 39,
                                                                }}
                                                            />

                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    right: 0,
                                                                    bottom: "54px",
                                                                    display: "flex",
                                                                    gap: "8px",
                                                                    padding: "9px 11px",
                                                                    borderRadius: "999px",
                                                                    background: "rgba(15, 23, 42, 0.92)",
                                                                    border: "1px solid rgba(148, 163, 184, 0.22)",
                                                                    boxShadow: "0 18px 45px rgba(0,0,0,0.45)",
                                                                    backdropFilter: "blur(14px)",
                                                                    zIndex: 40,
                                                                }}
                                                            >
                                                                {REACTIONS.map((reaction) => (
                                                                    <button
                                                                        key={reaction}
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleReaction(post.id, reaction);
                                                                        }}
                                                                        style={{
                                                                            width: "44px",
                                                                            height: "44px",
                                                                            borderRadius: "999px",
                                                                            border:
                                                                                myReaction?.reaction === reaction
                                                                                    ? "1px solid rgba(251, 191, 36, 0.65)"
                                                                                    : "1px solid rgba(255,255,255,0.06)",
                                                                            background:
                                                                                myReaction?.reaction === reaction
                                                                                    ? "rgba(251, 191, 36, 0.16)"
                                                                                    : "rgba(255,255,255,0.07)",
                                                                            cursor: "pointer",
                                                                            fontSize: "24px",
                                                                            lineHeight: 1,
                                                                            display: "grid",
                                                                            placeItems: "center",
                                                                            transition: "transform 0.16s ease, background 0.16s ease",
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.currentTarget.style.transform = "translateY(-6px) scale(1.22)";
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.currentTarget.style.transform =
                                                                                myReaction?.reaction === reaction
                                                                                    ? "translateY(-3px) scale(1.1)"
                                                                                    : "translateY(0) scale(1)";
                                                                        }}
                                                                    >
                                                                        {reaction}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (myReaction) {
                                                                toggleReaction(post.id, myReaction.reaction);
                                                            } else {
                                                                toggleReaction(post.id, "❤️");
                                                            }
                                                        }}
                                                        style={{
                                                            height: "46px",
                                                            minWidth: "96px",
                                                            padding: "0 18px",
                                                            borderRadius: "999px",
                                                            background: myReaction
                                                                ? "linear-gradient(135deg, rgba(239,68,68,0.24), rgba(251,113,133,0.14))"
                                                                : "rgba(15, 23, 42, 0.78)",
                                                            color: myReaction ? "#fecaca" : "#e2e8f0",
                                                            border: myReaction
                                                                ? "1px solid rgba(248, 113, 113, 0.42)"
                                                                : "1px solid rgba(226, 232, 240, 0.32)",
                                                            cursor: "pointer",
                                                            fontWeight: "bold",
                                                            fontSize: "16px",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: "7px",
                                                            boxShadow: myReaction
                                                                ? "0 0 22px rgba(239,68,68,0.16)"
                                                                : "0 8px 22px rgba(0,0,0,0.18)",
                                                            transition: "0.18s ease",
                                                        }}
                                                    >
                                                        <span style={{ fontSize: myReaction ? "20px" : "18px" }}>
                                                            {myReaction?.reaction || "🤍"}
                                                        </span>
                                                        <span>{postReactions.length}</span>
                                                    </button>
                                                </div>

                                                {reactionCounts.length > 0 && (
                                                    <div
                                                        style={{
                                                            marginTop: "8px",
                                                            display: "flex",
                                                            justifyContent: "flex-end",
                                                            gap: "6px",
                                                            flexWrap: "wrap",
                                                        }}
                                                    >
                                                        {reactionCounts.map((item) => (
                                                            <div
                                                                key={item.reaction}
                                                                data-reaction-pill="true"
                                                                style={{
                                                                    position: "relative",
                                                                }}
                                                                onMouseEnter={() => {
                                                                    setHoveredLikesPostId(null);
                                                                    setHoveredReactionKey(`${post.id}-${item.reaction}`);
                                                                }}
                                                                onMouseLeave={() => {
                                                                    setHoveredReactionKey(null);
                                                                    setHoveredLikesPostId(post.id);
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: "5px",
                                                                        padding: "5px 9px",
                                                                        borderRadius: "999px",
                                                                        background: "rgba(15, 23, 42, 0.62)",
                                                                        border: "1px solid rgba(148, 163, 184, 0.14)",
                                                                        color: "#cbd5e1",
                                                                        fontSize: "13px",
                                                                        fontWeight: "bold",
                                                                        cursor: "default",
                                                                    }}
                                                                >
                                                                    <span>{item.reaction}</span>
                                                                    <span>{item.count}</span>
                                                                </div>

                                                                {hoveredReactionKey === `${post.id}-${item.reaction}` && (
                                                                    <div
                                                                        style={{
                                                                            position: "absolute",
                                                                            right: 0,
                                                                            top: "34px",
                                                                            minWidth: "170px",
                                                                            padding: "10px",
                                                                            borderRadius: "14px",
                                                                            background: "rgba(15, 23, 42, 0.96)",
                                                                            border: "1px solid rgba(148, 163, 184, 0.2)",
                                                                            boxShadow: "0 16px 35px rgba(0,0,0,0.42)",
                                                                            zIndex: 60,
                                                                            display: "flex",
                                                                            flexDirection: "column",
                                                                            gap: "6px",
                                                                        }}
                                                                    >
                                                                        {postReactions
                                                                            .filter((like) => like.reaction === item.reaction)
                                                                            .map((like) => (
                                                                                <div
                                                                                    key={like.id}
                                                                                    style={{
                                                                                        padding: "7px 8px",
                                                                                        borderRadius: "10px",
                                                                                        background: "rgba(30, 41, 59, 0.72)",
                                                                                        color: "#e2e8f0",
                                                                                        fontWeight: "bold",
                                                                                        fontSize: "13px",
                                                                                    }}
                                                                                >
                                                                                    {item.reaction} {getUsername(like.user_id)}
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
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

                                                    {true && (
                                                        <div
                                                            className="pepp-comment-form"
                                                            style={{
                                                                display: "flex",
                                                                gap: "10px",
                                                                marginTop: "4px",
                                                            }}
                                                        >
                                                            <input
                                                                placeholder="Skriv lite pepp..."
                                                                maxLength={180}
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
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                marginBottom: hideLeaderboard ? 0 : "14px",
                            }}
                        >
                            <h2 style={{ margin: 0 }}>👥 Topp 3 bland vänner</h2>

                            <button
                                onClick={toggleHideLeaderboard}
                                type="button"
                                title={hideLeaderboard ? "Visa topplistan" : "Dölj topplistan"}
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "999px",
                                    border: `1px solid ${theme.border}`,
                                    background: "rgba(255,255,255,0.08)",
                                    color: theme.text,
                                    cursor: "pointer",
                                    fontWeight: 900,
                                    fontSize: "20px",
                                    lineHeight: 1,
                                }}
                            >
                                {hideLeaderboard ? "+" : "−"}
                            </button>
                        </div>

                        {!hideLeaderboard && (
                            <>


                                {friendLeaderboard.length === 0 ? (
                                    <p style={{ color: "#94a3b8" }}>Ingen har registrerat tid denna vecka.</p>
                                ) : (
                                    friendLeaderboard.map(([id, minutes], index) => (
                                        <div key={id} style={leaderboardRowStyle}>
                                            <strong>
                                                {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"} {getUsername(id)}
                                            </strong>
                                            <span>{formatHours(minutes)}</span>
                                        </div>
                                    ))

                                )}
                                {myFriendLeaderboardIndex !== -1 && (
                                    <div
                                        style={{
                                            marginTop: "12px",
                                            padding: "12px",
                                            borderRadius: "12px",
                                            background: "rgba(37, 99, 235, 0.14)",
                                            border: "1px solid rgba(96, 165, 250, 0.35)",
                                        }}
                                    >
                                        <strong>Din placering: #{myFriendLeaderboardIndex + 1}</strong>

                                        <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                                            {formatHours(myFriendLeaderboardMinutes)}
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
                            </>
                        )}

                        {hideLeaderboard && (
                            <p style={{ color: "#94a3b8", margin: "12px 0 0" }}>
                                Topplistan är dold. Klicka på + för att visa den igen.
                            </p>
                        )}
                    </section>

                    <section style={cardStyle(theme)}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                marginBottom: hideGlobalLeaderboard ? 0 : "14px",
                            }}
                        >
                            <h2 style={{ margin: 0 }}>🌍 Topp 5 alla användare</h2>

                            <button
                                onClick={toggleHideGlobalLeaderboard}
                                type="button"
                                title={hideGlobalLeaderboard ? "Visa topplistan" : "Dölj topplistan"}
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "999px",
                                    border: `1px solid ${theme.border}`,
                                    background: "rgba(255,255,255,0.08)",
                                    color: theme.text,
                                    cursor: "pointer",
                                    fontWeight: 900,
                                    fontSize: "20px",
                                    lineHeight: 1,
                                }}
                            >
                                {hideGlobalLeaderboard ? "+" : "−"}
                            </button>
                        </div>

                        {!hideGlobalLeaderboard && (
                            <>
                                {globalLeaderboard.length === 0 ? (
                                    <p style={{ color: "#94a3b8" }}>
                                        Ingen har registrerat tid denna vecka.
                                    </p>
                                ) : (
                                    globalLeaderboard.map(([id, minutes], index) => (
                                        <div key={id} style={leaderboardRowStyle}>
                                            <strong>
                                                {index === 0
                                                    ? "🥇"
                                                    : index === 1
                                                        ? "🥈"
                                                        : index === 2
                                                            ? "🥉"
                                                            : index === 3
                                                                ? "🏅"
                                                                : "🎖️"}
                                                {globalProfiles.find((profile) => profile.id === id)?.username ||
                                                    getUsername(id)}
                                            </strong>

                                            <span>{formatHours(minutes)}</span>
                                        </div>
                                    ))
                                )}

                                {myGlobalLeaderboardIndex !== -1 && (
                                    <div
                                        style={{
                                            marginTop: "12px",
                                            padding: "12px",
                                            borderRadius: "12px",
                                            background: "rgba(37, 99, 235, 0.14)",
                                            border: "1px solid rgba(96, 165, 250, 0.35)",
                                        }}
                                    >
                                        <strong>Din globala placering: #{myGlobalLeaderboardIndex + 1}</strong>

                                        <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                                            {formatHours(myGlobalLeaderboardMinutes)}
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
                                                checked={showOnGlobalLeaderboard}
                                                onChange={toggleGlobalLeaderboardVisibility}
                                                style={{
                                                    width: "16px",
                                                    height: "16px",
                                                    cursor: "pointer",
                                                }}
                                            />

                                            Delta i globala topplistan
                                        </label>
                                    </div>
                                )}
                            </>
                        )}

                        {hideGlobalLeaderboard && (
                            <p style={{ color: "#94a3b8", margin: "12px 0 0" }}>
                                Topplistan är dold. Klicka på + för att visa den igen.
                            </p>
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

                                    <button
                                        onClick={() => removeFriend(friendId)}
                                        style={{
                                            width: "30px",
                                            height: "30px",
                                            borderRadius: "999px",
                                            border: "1px solid rgba(248, 113, 113, 0.45)",
                                            background: "rgba(239, 68, 68, 0.12)",
                                            color: "#fecaca",
                                            cursor: "pointer",
                                            fontWeight: "bold",
                                            fontSize: "15px",
                                            lineHeight: 1,
                                        }}
                                        title="Ta bort vän"
                                    >
                                        ✕
                                    </button>
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