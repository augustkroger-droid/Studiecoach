"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NavBar from "@/components/NavBar";
import { getSavedTheme, THEMES, ThemeKey } from "@/lib/themes";
import ThemePicker from "@/components/ThemePicker";

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

type Announcement = {
  id: string;
  message: string;
  created_at: string;
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
  hide_leaderboard?: boolean;
  is_admin?: boolean;
  role?: "student" | "teacher" | "admin" | null;
};

type TeacherStudentAccess = {
  id: string;
  teacher_id: string;
  student_id: string;
  created_at: string;
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
  const [themeKey, setThemeKey] = useState<ThemeKey>("ocean");

  useEffect(() => {
    setThemeKey(getSavedTheme());
  }, []);

  const theme = THEMES[themeKey];
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [nextSession, setNextSession] = useState<StudySession | null>(null);
  const [nextExam, setNextExam] = useState<Exam | null>(null);
  const [posts, setPosts] = useState<StudyPost[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [hideLeaderboard, setHideLeaderboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementText, setAnnouncementText] = useState("");

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
      .select("id, username, show_on_leaderboard, hide_leaderboard, is_admin, role")
      .eq("id", user.id)
      .single();

    setMyProfile(profileData);
    setUsername(profileData?.username || "Elev");
    setHideLeaderboard(profileData?.hide_leaderboard ?? false);

    const isAdmin = profileData?.is_admin === true || profileData?.role === "admin";
    const isTeacher = profileData?.role === "teacher" || isAdmin;

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

    let teacherStudentIds: string[] = [];

    if (isTeacher && !isAdmin) {
      const { data: teacherStudentData, error: teacherStudentError } = await supabase
        .from("teacher_students")
        .select("student_id")
        .eq("teacher_id", user.id);

      if (teacherStudentError) {
        alert(teacherStudentError.message);
      }

      teacherStudentIds = (teacherStudentData || []).map(
        (row: Pick<TeacherStudentAccess, "student_id">) => row.student_id
      );
    }

    const visibleUserIds = Array.from(
      new Set([user.id, ...acceptedFriendIds, ...teacherStudentIds])
    );

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoString = formatDate(oneWeekAgo);

    let postQuery = supabase
      .from("study_posts")
      .select("*")
      .gte("date", oneWeekAgoString)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      postQuery = postQuery.in("user_id", visibleUserIds);
    }

    const { data: postData } = await postQuery;

    setPosts(postData || []);

    let profileQuery = supabase
      .from("profiles")
      .select("id, username, show_on_leaderboard, hide_leaderboard, is_admin")

    if (!isAdmin) {
      profileQuery = profileQuery.in("id", visibleUserIds);
    }

    const { data: profileList } = await profileQuery;

    setProfiles(profileList || []);

    const { data: announcementData } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);

    setAnnouncements(announcementData || []);

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function addAnnouncement() {
    const message = announcementText.trim();

    if (!message) return;

    const { error } = await supabase
      .from("announcements")
      .insert({
        message,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setAnnouncementText("");

    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);

    setAnnouncements(data || []);
  }

  async function deleteAnnouncement(id: string) {
    const confirmed = window.confirm("Ta bort uppdateringen?");

    if (!confirmed) return;

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setAnnouncements((current) =>
      current.filter((announcement) => announcement.id !== id)
    );
  }

  function getUsername(id: string) {
    if (id === userId) return username;
    return profiles.find((profile) => profile.id === id)?.username || "Okänd";
  }

  function isToday(dateString: string) {
    return dateString === formatDate(new Date());
  }

  const today = new Date();
  const day = today.getDay();

  const diff = (day === 0 ? -6 : 1) - day;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const weekStart = formatDate(monday);

  const postsLastWeek = posts.filter((post) => {
    return post.date >= weekStart;
  });

  const leaderboardMap: Record<string, number> = {};

  postsLastWeek.forEach((post) => {
    leaderboardMap[post.user_id] =
      (leaderboardMap[post.user_id] || 0) + post.duration;
  });

  const leaderboard = Object.entries(leaderboardMap)
    .filter(([id]) => {
      const profile = profiles.find((profile) => profile.id === id);
      return profile?.show_on_leaderboard ?? false;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

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
      <div
        className="home-topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <NavBar />


        <button
          className="home-logout-button"
          onClick={logout}
          style={{
            marginTop: "72px",
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
      <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
      <header
        className="home-header"
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
        className="home-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "20px",
          alignItems: "stretch",
          marginBottom: "22px",
        }}
      >
        <div style={heroCardStyle(theme)}>
          <div
            className="home-next-grid"
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
                      style={primaryLinkStyle(theme)}
                    >
                      Påbörja studiepass →
                    </Link>
                  ) : (
                    <Link href="/kalender" style={primaryLinkStyle(theme)}>
                      Se i kalendern →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
                    Du har inget kommande studiepass inlagt ännu.
                  </p>

                  <Link href="/kalender" style={primaryLinkStyle(theme)}>
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

                  <Link href="/kalender" style={primaryLinkStyle(theme)}>
                    Se i kalendern →
                  </Link>
                </>
              ) : (
                <>
                  <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
                    Du har inget kommande prov inlagt ännu.
                  </p>

                  <Link href="/kalender" style={primaryLinkStyle(theme)}>
                    Lägg till prov →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={heroCardStyle(theme)}>
          <h2 style={{ marginTop: 0 }}>🔥 Snabbstart</h2>

          <div style={{ display: "grid", gap: "12px" }}>
            <QuickLink theme={theme} href="/kalender" title="Kalender" emoji="📅" />
            <QuickLink theme={theme} href="/pepp" title="Pepp" emoji="🔥" />
            <QuickLink theme={theme} href="/tips" title="Studietips" emoji="💡" />
            <QuickLink theme={theme} href="/profil" title="Profil" emoji="👤" />
          </div>
        </div>
      </section>

      <section
        className="home-bottom-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <section style={cardStyle(theme)}>
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
              {posts.slice(0, 4).map((post) => (
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
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
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
              <h2 style={{ margin: 0 }}>🏆 Veckans topp 3</h2>

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
              </>
            )}

            {hideLeaderboard && (
              <p style={{ color: "#94a3b8", margin: "12px 0 0" }}>
                Topplistan är dold. Klicka på + för att visa den igen.
              </p>
            )}
          </section>

          <section style={cardStyle(theme)}>
            <h2 style={{ marginTop: 0 }}>📢 Uppdateringar</h2>

            {myProfile?.is_admin && (
              <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
                <textarea
                  placeholder="Skriv en kort uppdatering..."
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: `1px solid ${theme.border}`,
                    background: "rgba(2, 6, 23, 0.65)",
                    color: theme.text,
                    resize: "vertical",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />

                <button
                  onClick={addAnnouncement}
                  style={{
                    padding: "11px 14px",
                    borderRadius: "12px",
                    border: `1px solid ${theme.border}`,
                    background: "rgba(255,255,255,0.14)",
                    color: theme.text,
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  Publicera
                </button>
              </div>
            )}

            {announcements.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>Inga uppdateringar ännu.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    style={{
                      position: "relative",
                      padding: myProfile?.is_admin ? "13px 42px 13px 13px" : "13px",
                      borderRadius: "14px",
                      background: "rgba(2, 6, 23, 0.55)",
                      border: "1px solid rgba(148, 163, 184, 0.16)",
                      color: "#cbd5e1",
                      lineHeight: 1.55,
                    }}
                  >
                    {announcement.message}

                    {myProfile?.is_admin && (
                      <button
                        onClick={() => deleteAnnouncement(announcement.id)}
                        title="Ta bort uppdatering"
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          width: "26px",
                          height: "26px",
                          borderRadius: "999px",
                          border: "1px solid rgba(248, 113, 113, 0.45)",
                          background: "rgba(239, 68, 68, 0.14)",
                          color: "#fecaca",
                          cursor: "pointer",
                          fontWeight: "bold",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

function QuickLink({
  theme,
  href,
  title,
  emoji,
}: {
  theme: typeof THEMES[ThemeKey];
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
        background: theme.cardSoft,
        border: `1px solid ${theme.border}`,
        color: theme.text,
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

const heroCardStyle = (theme: typeof THEMES[ThemeKey]) => ({
  padding: "26px",
  borderRadius: "24px",
  background: theme.card,
  border: `1px solid ${theme.border}`,
  boxShadow: "0 22px 50px rgba(0,0,0,0.35)",
});

const cardStyle = (theme: typeof THEMES[ThemeKey]) => ({
  padding: "22px",
  borderRadius: "22px",
  background: theme.card,
  border: `1px solid ${theme.border}`,
  boxShadow: "0 18px 40px rgba(0,0,0,0.3)",
});

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

const primaryLinkStyle = (theme: typeof THEMES[ThemeKey]) => ({
  display: "inline-block",
  marginTop: "12px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.14)",
  border: `1px solid ${theme.border}`,
  color: theme.text,
  textDecoration: "none",
  fontWeight: "bold",
});

const smallLinkStyle = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: "bold",
};