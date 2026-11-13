
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProfileMenu from "@/components/ProfileMenu";

type Notification = {
  id: string;
  title: string;
  message: string;
  notification_type: "new_lesson" | "new_practice";
  language: string;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;

  async function loadNotifications() {
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setNotifications([]);
        setError("");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load notifications.");
      }

      setNotifications(data.notifications || []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load notifications."
      );
    }
  }

  useEffect(() => {
    void loadNotifications();

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    function handleFocus() {
      void loadNotifications();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function openNotification(notification: Notification) {
    setLoading(true);
    setError("");

    try {
      if (!notification.read_at) {
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
          throw new Error(
            data.error || "Unable to mark notification as read."
          );
        }

        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? { ...item, read_at: new Date().toISOString() }
              : item
          )
        );
      }

      setOpen(false);

      if (notification.notification_type === "new_lesson") {
        if (notification.reference_id) {
          window.location.href = `/lesson/${notification.reference_id}`;
        } else {
          window.location.href = "/lesson";
        }
      } else if (notification.notification_type === "new_practice") {
        window.location.href = `/practice?language=${encodeURIComponent(
          notification.language
        )}`;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open notification."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="notification-container" ref={menuRef}>
      <button
        type="button"
        className="notification-button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);

          if (nextOpen) {
            void loadNotifications();
          }
        }}
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
          <span className="notification-red-dot" />
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>

            {unreadCount > 0 && (
              <span>{unreadCount} unread</span>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <div className="notification-empty">
              <p>Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="notification-empty">
              <p>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <p>No notifications yet.</p>
              <span>Your Ukti updates will appear here.</span>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={
                    notification.read_at
                      ? "notification-item"
                      : "notification-item unread"
                  }
                  disabled={loading}
                  onClick={() => void openNotification(notification)}
                >
                  <strong>{notification.title}</strong>

                  <span>{notification.message}</span>

                  <small>
                    {new Date(
                      notification.created_at
                    ).toLocaleString()}
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  // Check authentication before navigating.
  // Logged-out users go to signup.
  async function navigateWithAuth(destination: string) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.push("/signup");
        return;
      }

      router.push(destination);
    } catch (error) {
      console.error("Authentication check failed:", error);
      router.push("/signup");
    }
  }

  return (
    <main className="Ukti-page" id="home">
      {/* NAVIGATION */}
      <header className="navbar">
        <nav className="nav-links">
          <Link className="active" href="/">
            Home
          </Link>

          <a
            href="/lesson"
            onClick={(event) => {
              event.preventDefault();
              void navigateWithAuth("/lesson");
            }}
          >
            Lessons
          </a>

          <a
            href="/practice"
            onClick={(event) => {
              event.preventDefault();
              void navigateWithAuth("/practice");
            }}
          >
            Practice
          </a>

          <a
            href="/progress"
            onClick={(event) => {
              event.preventDefault();
              void navigateWithAuth("/progress");
            }}
          >
            Progress
          </a>
        </nav>

        <div className="nav-actions">
          <NotificationMenu />
          <ProfileMenu />
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
              Ukti<span>.</span>
            </span>
          </h1>

          <h2>Pronunciation-First Language Learning</h2>

          <p className="hero-description">
            Learn to speak with confidence. Listen, practise,
            and improve your pronunciation one word at a time.
            Make every word count with Ukti.
          </p>

          <a
            href="/lesson"
            className="start-button"
            onClick={(event) => {
              event.preventDefault();
              void navigateWithAuth("/lesson");
            }}
          >
            Start Learning
            <span aria-hidden="true">→</span>
          </a>

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
          {/* LISTEN */}
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

          {/* SPEAK */}
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

          {/* LEARN */}
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

          {/* TRACK */}
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
