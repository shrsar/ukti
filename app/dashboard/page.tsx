
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfileMenu from "@/components/ProfileMenu";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  language: string | null;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
};

export default function Dashboard() {
  const router = useRouter();

  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");

  async function fetchNotifications() {
    setNotificationsLoading(true);
    setNotificationError("");

    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load notifications.");
      }

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to load notifications."
      );
    } finally {
      setNotificationsLoading(false);
    }
  }

  // Check authentication without redirecting logged-out visitors.
  useEffect(() => {
    let active = true;

    async function checkUser() {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data.user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);
        setLoading(false);

        void fetchNotifications();
      } catch {
        if (!active) return;

        setIsAuthenticated(false);
        setLoading(false);
      }
    }

    void checkUser();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  // Logged-out users go to signup; logged-in users go to lessons.
  async function handleStartLearning() {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.push("/signup");
        return;
      }

      router.push("/lessons");
    } catch {
      router.push("/signup");
    }
  }

  async function markNotificationAsRead(notification: Notification) {
    if (notification.read_at) return;

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: notification.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to mark notification as read.");
      }

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to update notification."
      );
    }
  }

  async function markAllAsRead() {
    if (unreadCount === 0) return;

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markAll: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to mark notifications as read.");
      }

      const now = new Date().toISOString();

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          read_at: item.read_at || now,
        }))
      );

      setUnreadCount(0);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to update notifications."
      );
    }
  }

  async function openNotification(notification: Notification) {
    await markNotificationAsRead(notification);

    setNotificationsOpen(false);

    if (notification.notification_type === "practice") {
      router.push(
        notification.language
          ? `/practice?language=${encodeURIComponent(notification.language)}`
          : "/practice"
      );
    } else if (notification.notification_type === "lesson") {
      router.push("/lessons");
    }
  }

  if (loading) {
    return (
      <main className="Ukti-page">
        <p style={{ textAlign: "center", padding: "80px 20px" }}>
          Loading KaKhaGaGha...
        </p>
      </main>
    );
  }

  return (
    <main className="Ukti-page" id="home">
      {/* NAVIGATION */}
      <header className="navbar">
        <nav className="nav-links">
          <a className="active" href="#home">
            Home
          </a>

          <Link href="/lessons">Lessons</Link>

          <Link href="/practice">Practice</Link>

          <a href="/progress">Progress</a>
        </nav>

        <div className="nav-actions">
          {isAuthenticated && (
            <>
              {/* NOTIFICATIONS */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="notification-button"
                  aria-label={`Notifications, ${unreadCount} unread`}
                  aria-expanded={notificationsOpen}
                  onClick={() => {
                    const opening = !notificationsOpen;
                    setNotificationsOpen(opening);

                    if (opening) {
                      void fetchNotifications();
                    }
                  }}
                  style={{ position: "relative" }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "3px",
                        right: "3px",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: "#e53935",
                        border: "2px solid white",
                      }}
                    />
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    role="region"
                    aria-label="Your notifications"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 12px)",
                      right: 0,
                      width: "min(360px, calc(100vw - 32px))",
                      maxHeight: "430px",
                      overflowY: "auto",
                      background: "#ffffff",
                      color: "#222222",
                      border: "1px solid #e8e8e8",
                      borderRadius: "14px",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
                      zIndex: 1000,
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "14px",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "17px" }}>
                        Notifications
                      </h3>

                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllAsRead()}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#7652c8",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    {notificationError && (
                      <p
                        role="alert"
                        style={{
                          fontSize: "13px",
                          color: "#c62828",
                        }}
                      >
                        {notificationError}
                      </p>
                    )}

                    {notificationsLoading && (
                      <p style={{ fontSize: "13px" }}>
                        Loading notifications...
                      </p>
                    )}

                    {!notificationsLoading &&
                      notifications.length === 0 && (
                        <p
                          style={{
                            textAlign: "center",
                            padding: "24px 8px",
                            fontSize: "14px",
                            color: "#777777",
                          }}
                        >
                          You're all caught up. No notifications yet.
                        </p>
                      )}

                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => void openNotification(notification)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          borderBottom: "1px solid #eeeeee",
                          background: notification.read_at
                            ? "#ffffff"
                            : "#f6f2ff",
                          padding: "13px 10px",
                          cursor: "pointer",
                          borderRadius: "8px",
                          color: "#222222",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "8px",
                          }}
                        >
                          <strong style={{ fontSize: "13px" }}>
                            {notification.title}
                          </strong>

                          {!notification.read_at && (
                            <span
                              aria-label="Unread"
                              style={{
                                flexShrink: 0,
                                width: "8px",
                                height: "8px",
                                marginTop: "4px",
                                borderRadius: "50%",
                                background: "#7652c8",
                              }}
                            />
                          )}
                        </div>

                        <p
                          style={{
                            fontSize: "12px",
                            lineHeight: 1.5,
                            margin: "6px 0",
                            color: "#555555",
                          }}
                        >
                          {notification.message}
                        </p>

                        <span
                          style={{
                            fontSize: "11px",
                            color: "#888888",
                          }}
                        >
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ProfileMenu />
            </>
          )}
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-illustration">
          <div className="illustration-glow" />
          <div className="sound-wave wave-one" />
          <div className="sound-wave wave-two" />
          <div className="sound-wave wave-three" />

          <Image
            src="/images/ukti-woman.png"
            alt="Illustration of a woman speaking"
            width={620}
            height={620}
            priority
            className="woman-image"
          />

          <div className="floating-note note-one">Aa</div>
          <div className="floating-note note-two">♪</div>
          <div className="floating-note note-three">अ</div>
        </div>

        <div className="hero-content">
          <span className="eyebrow">
            YOUR LANGUAGE LEARNING COMPANION
          </span>

          <h1>
            Welcome to
            <span className="hero-title-brand">
              KaKhaGaGha<span>.</span>
            </span>
          </h1>

          <h2>Pronunciation-First Language Learning</h2>

          <p className="hero-description">
            Learn to speak with confidence. Listen, practise,
            and improve your pronunciation one word at a time.
            Make every word count with KaKhaGaGha.
          </p>

          <button
            type="button"
            className="start-button"
            onClick={() => void handleStartLearning()}
          >
            Start Learning
            <span aria-hidden="true">→</span>
          </button>

          <div className="hero-caption">
            <span className="caption-line" />
            <span>Listen. Speak. Learn.</span>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="features-section" id="lessons">
        <div className="section-heading">
          <span className="eyebrow">YOUR JOURNEY STARTS HERE</span>
          <h2>Learn at your own pace</h2>
          <p>
            Build your language skills through four simple steps.
          </p>
        </div>

        <div className="feature-grid">
          <article className="feature-card listen-card" id="practice">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 10v4m4-8v12m4-15v18m4-14v10m4-7v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3>Listen</h3>
            <p>
              Hear words and phrases clearly to understand
              their pronunciation.
            </p>
          </article>

          <article className="feature-card speak-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Zm-7-4a7 7 0 0 0 14 0m-7 7v4m-4 0h8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Speak</h3>
            <p>
              Practise speaking and develop confidence
              in your everyday conversations.
            </p>
          </article>

          <article className="feature-card learn-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Zm0 0V21m4-13h8m-8 4h6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Learn</h3>
            <p>
              Explore vocabulary, expressions, and
              useful language lessons.
            </p>
          </article>

          <article className="feature-card track-card" id="progress">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 19V5m0 14h17M8 15l4-4 3 2 5-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Track</h3>
            <p>
              Follow your progress and see how far
              your language skills have come.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
