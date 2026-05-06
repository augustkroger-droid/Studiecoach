"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";

type Profile = {
  username: string;
};

type StudySession = {
  id: string;
  subject: string;
  duration: number;
  date: string;
  start_time?: string | null;
  status?: string;
};

type StudyPost = {
  id: string;
  user_id: string;
  subject: string;
  duration: number;
  date: string;
  comment?: string | null;
  created_at: string;
};

type Exam = {
  id: string;
  name: string;
  date: string;
  color: string;
};

type FriendRequest = {
  from_user_id: string;
  to_user_id: string;
  status: string;
};

type UserProfile = {
  id: string;
  username: string;
  show_on_leaderboard?: boolean;
};

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDisplayDate(dateString: string) {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function daysUntil(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - today.getTime()) / 86400000
  );
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
  if (hours > 0) return `${hours} h`;
  return `${mins} min`;
}

export default function Home() {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [nextSession, setNextSession] = useState<StudySession | null>(null);
  const [nextExam, setNextExam] = useState<Exam | null>(null);
  const [posts, setPosts] = useState<StudyPost[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHome();
  }, []);

  async function loadHome() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    setUsername(profileData?.username || "Elev");

    const today = formatDate(new Date());

    const { data: sessionData } = await supabase
      .from("study_sessions")
      .select("id, subject, duration, date, start_time, status")
      .eq("user_id", user.id)
      .gte("date", today)
      .neq("status", "done")
      .neq("status", "missed")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(1);

    setNextSession(sessionData?.[0] || null);

    const { data: examData } = await supabase
      .from("exams")
      .select("*")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1);

    setNextExam(examData?.[0] || null);

    const { data: requestData } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);

    setFriendRequests(requestData || []);

    const acceptedFriendIds =
      requestData
        ?.filter((request) => request.status === "accepted")
        .map((request) =>
          request.from_user_id === user.id
            ? request.to_user_id
            : request.from_user_id
        ) || [];

    const visibleUserIds = [user.id, ...acceptedFriendIds];

    const { data: postData } = await supabase
      .from("study_posts")
      .select("*")
      .in("user_id", visibleUserIds)
      .order("created_at", { ascending: false })
      .limit(4);

    setPosts(postData || []);

    const { data: profileList } = await supabase
      .from("profiles")
      .select("id, username, show_on_leaderboard")
      .in("id", visibleUserIds);

    setProfiles(profileList || []);
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function getUsername(id: string) {
    if (id === userId) return username;
    return profiles.find((profile) => profile.id === id)?.username || "Okänd";
  }

  function isToday(dateString: string) {
    return dateString === formatDate(new Date());
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const leaderboardMap: Record<string, number> = {};

  posts
    .filter((post) => new Date(post.date) >= oneWeekAgo)
    .forEach((post) => {
      const profile = profiles.find((profile) => profile.id === post.user_id);
      const isMe = post.user_id === userId;
      const isVisible = profile?.show_on_leaderboard ?? false;

      if (isMe || isVisible) {
        leaderboardMap[post.user_id] =
          (leaderboardMap[post.user_id] || 0) + post.duration;
      }
    });

  const leaderboard = Object.entries(leaderboardMap)
    .filter(([id]) => {
      if (id === userId) {
        const profile = profiles.find((profile) => profile.id === id);
        return profile?.show_on_leaderboard ?? false;
      }

      const profile = profiles.find((profile) => profile.id === id);
      return profile?.show_on_leaderboard ?? false;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        background:
          "radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
        color: "#e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <NavBar />

        <button
          onClick={logout}
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#fecaca",
            border: "1px solid rgba(248, 113, 113, 0.45)",
            padding: "11px 16px",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Logga ut
        </button>
      </div>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px",
          marginBottom: "30px",
        }}
      >
        <div>

          <h1 style={{ fontSize: "48px", margin: "8px 0 10px" }}>
            Hej, {loading ? "..." : username}! 👋
          </h1>

          <p
            style={{
              color: "#94a3b8",
              fontSize: "18px",
              maxWidth: "720px",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Här är en snabb överblick över dina studier, kommande pass och vad
            som händer på Pepp.
          </p>
        </div>


      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "20px",
          alignItems: "stretch",
          marginBottom: "22px",
        }}
      >
        <div style={heroCardStyle}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "18px",
              height: "100%",
            }}
          >
            <div
              style={{
                padding: "20px",
                borderRadius: "18px",
                background: "rgba(2, 6, 23, 0.45)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>📌 Nästa studiepass</h2>

              {nextSession ? (
                <>
                  <h3 style={{ fontSize: "30px", margin: "8px 0" }}>
                    {nextSession.subject}
                  </h3>

                  <p style={{ color: "#cbd5e1", fontWeight: "bold" }}>
                    {formatDisplayDate(nextSession.date)}{" "}
                    {nextSession.start_time ? `• ${nextSession.start_time}` : ""}
                  </p>

                  <p style={{ color: "#94a3b8" }}>
                    Planerat: {formatTime(nextSession.duration)}
                  </p>

                  {isToday(nextSession.date) ? (
                    <Link
                      href={`/pass/${nextSession.id}?mode=study`}
                      style={primaryLinkStyle}
                    >
                      Påbörja studiepass →
                    </Link>
                  ) : (
                    <Link href="/kalender" style={primaryLinkStyle}>
                      Se i kalendern →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
                    Du har inget kommande studiepass inlagt ännu.
                  </p>

                  <Link href="/kalender" style={primaryLinkStyle}>
                    Planera ett pass →
                  </Link>
                </>
              )}
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "18px",
                background: "rgba(2, 6, 23, 0.45)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>📝 Nästa prov</h2>

              {nextExam ? (
                <>
                  <h3 style={{ fontSize: "30px", margin: "8px 0" }}>
                    {nextExam.name}
                  </h3>

                  <p style={{ color: "#cbd5e1", fontWeight: "bold" }}>
                    {formatDisplayDate(nextExam.date)}
                  </p>

                  <p style={{ color: "#94a3b8" }}>
                    {daysUntil(nextExam.date)} dagar kvar
                  </p>

                  <Link href="/kalender" style={primaryLinkStyle}>
                    Se i kalendern →
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
                    Du har inget kommande prov inlagt ännu.
                  </p>

                  <Link href="/kalender" style={primaryLinkStyle}>
                    Lägg till prov →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={heroCardStyle}>
          <h2 style={{ marginTop: 0 }}>🔥 Snabbstart</h2>

          <div style={{ display: "grid", gap: "12px" }}>
            <QuickLink href="/kalender" title="Kalender" emoji="📅" />
            <QuickLink href="/pepp" title="Pepp" emoji="🔥" />
            <QuickLink href="/tips" title="Studietips" emoji="💡" />
            <QuickLink href="/profil" title="Profil" emoji="👤" />
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <section style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h2 style={{ margin: 0 }}>Senaste från Pepp</h2>
            <Link href="/pepp" style={smallLinkStyle}>
              Visa allt →
            </Link>
          </div>

          {posts.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>Inga postade studiepass ännu.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {posts.map((post) => (
                <article key={post.id} style={miniPostStyle}>
                  <strong>{getUsername(post.user_id)}</strong>

                  <p
                    style={{
                      margin: "6px 0",
                      color: "#cbd5e1",
                      fontWeight: "bold",
                    }}
                  >
                    Studerade {post.subject || "ett ämne"} i{" "}
                    {formatTime(post.duration)}
                  </p>

                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "14px" }}>
                    {formatDisplayDate(post.date)}
                  </p>

                  {post.comment && (
                    <p
                      style={{
                        margin: "10px 0 0",
                        padding: "10px",
                        borderRadius: "10px",
                        background: "rgba(2,6,23,0.55)",
                        color: "#cbd5e1",
                      }}
                    >
                      “{post.comment}”
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>🏆 Veckans topp 3</h2>

          {leaderboard.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>
              Ingen deltar i topplistan ännu.
            </p>
          ) : (
            leaderboard.map(([id, minutes], index) => (
              <div key={id} style={leaderboardRowStyle}>
                <strong>
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}{" "}
                  {getUsername(id)}
                </strong>
                <span>{formatTime(minutes)}</span>
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

function QuickLink({
  href,
  title,
  emoji,
}: {
  href: string;
  title: string;
  emoji: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "14px",
        borderRadius: "14px",
        background: "rgba(2, 6, 23, 0.55)",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        color: "#e2e8f0",
        textDecoration: "none",
        fontWeight: "bold",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <span>
        {emoji} {title}
      </span>
      <span>→</span>
    </Link>
  );
}

const heroCardStyle = {
  padding: "26px",
  borderRadius: "24px",
  background: "rgba(15, 23, 42, 0.78)",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  boxShadow: "0 22px 50px rgba(0,0,0,0.35)",
};

const cardStyle = {
  padding: "22px",
  borderRadius: "22px",
  background: "rgba(15, 23, 42, 0.72)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
};

const miniPostStyle = {
  padding: "16px",
  borderRadius: "16px",
  background: "rgba(30, 41, 59, 0.68)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
};

const leaderboardRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px",
  borderRadius: "12px",
  background: "rgba(2, 6, 23, 0.55)",
  marginBottom: "8px",
};

const primaryLinkStyle = {
  display: "inline-block",
  marginTop: "12px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "#2563eb",
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
};

const smallLinkStyle = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: "bold",
};