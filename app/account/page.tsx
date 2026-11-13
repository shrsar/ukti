
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Section =
  | "profile"
  | "password"
  | "subscription"
  | "notifications"
  | "delete";

type Subscription = {
  language: string;
  selected_plan: "basic" | "premium";
  subscription_status: string;
};

export default function AccountPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [section, setSection] = useState<Section>("profile");
  const [loading, setLoading] = useState(true);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [notifications, setNotifications] = useState(true);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      setUser(data.user);

      const { data: languageData, error: languageError } =
        await supabase
          .from("user_languages")
          .select("language, selected_plan, subscription_status")
          .eq("user_id", data.user.id);

      if (!active) return;

      if (!languageError) {
        setSubscriptions(languageData || []);
      }

      const { data: preferenceData } = await supabase
        .from("user_preferences")
        .select("notifications_enabled")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!active) return;

      if (preferenceData) {
        setNotifications(preferenceData.notifications_enabled);
      }

      setLoading(false);
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [supabase, router]);

  const name =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  async function handlePasswordChange() {
    setPasswordMessage("");

    if (password.length < 6) {
      setPasswordMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setPasswordMessage(error.message);
      } else {
        setPassword("");
        setConfirmPassword("");
        setPasswordMessage("Password updated successfully.");
      }
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleNotificationChange(enabled: boolean) {
    if (!user) return;

    setNotificationLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            notifications_enabled: enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        setMessage("Unable to save notification preference.");
      } else {
        setNotifications(enabled);
        setMessage("Notification preference saved.");
      }
    } finally {
      setNotificationLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setMessage("");

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to delete account."
        );
      }

      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="account-page">
        <p>Loading your account...</p>
      </main>
    );
  }

  if (!user) return null;

  const menuItems: { id: Section; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "password", label: "Change Password" },
    { id: "subscription", label: "Subscription" },
    { id: "notifications", label: "Notifications" },
    { id: "delete", label: "Delete Account" },
  ];

  const currentSubscription = subscriptions.find(
    (item) => item.language === selectedLanguage
  );

  // Premium is shown only for a confirmed active Premium subscription.
  const isPremium =
    currentSubscription?.selected_plan === "premium" &&
    currentSubscription?.subscription_status === "active";

  return (
    <main className="account-page">
      <nav className="navbar">
        <Link href="/" className="account-home-link">
          ← Back to Home
        </Link>
      </nav>

      <div className="account-container">
        <h1>My Account</h1>

        <p className="account-subtitle">
          Manage your personal information and preferences.
        </p>

        <div className="account-layout">

          {/* LEFT SIDEBAR */}
          <aside className="account-sidebar">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  section === item.id
                    ? "account-menu-item active"
                    : "account-menu-item"
                }
                onClick={() => {
                  setSection(item.id);
                  setMessage("");
                  setPasswordMessage("");
                }}
              >
                {item.label}
              </button>
            ))}
          </aside>

          {/* RIGHT CONTENT */}
          <section className="account-content">

            {/* PROFILE */}
            {section === "profile" && (
              <div>
                <h2>Profile</h2>

                <p className="account-description">
                  Your registered account information.
                </p>

                <div className="account-field">
                  <label>Full Name</label>
                  <div>{name}</div>
                </div>

                <div className="account-field">
                  <label>Email Address</label>
                  <div>{user.email}</div>
                </div>
              </div>
            )}

            {/* CHANGE PASSWORD */}
            {section === "password" && (
              <div>
                <h2>Change Password</h2>

                <p className="account-description">
                  Create a new password for your Ukti account.
                </p>

                <div className="account-field">
                  <label>New Password</label>

                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="account-field">
                  <label>Confirm New Password</label>

                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder="Confirm new password"
                  />
                </div>

                <button
                  className="account-primary-button"
                  type="button"
                  disabled={passwordLoading}
                  onClick={handlePasswordChange}
                >
                  {passwordLoading
                    ? "Updating..."
                    : "Update Password"}
                </button>

                {passwordMessage && (
                  <p role="status">{passwordMessage}</p>
                )}
              </div>
            )}

            {/* SUBSCRIPTION */}
            {section === "subscription" && (
              <div>
                <h2>Subscription</h2>

                <p className="account-description">
                  Select a language to view its plan and subscription status.
                </p>

                {subscriptions.length === 0 ? (
                  <p>No language subscriptions found.</p>
                ) : (
                  <>
                    <div className="account-field">
                      <label htmlFor="subscription-language">
                        Select Language
                      </label>

                      <select
                        id="subscription-language"
                        value={selectedLanguage}
                        onChange={(e) =>
                          setSelectedLanguage(e.target.value)
                        }
                      >
                        <option value="">
                          Choose a language
                        </option>

                        {subscriptions.map((item) => (
                          <option
                            key={item.language}
                            value={item.language}
                          >
                            {item.language}
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentSubscription && (
                      <div className="account-subscription-card">
                        <h3>{currentSubscription.language}</h3>

                        <p>
                          <strong>Plan:</strong>{" "}
                          {isPremium ? "PREMIUM" : "BASIC"}
                        </p>

                        <p>
                          <strong>Status:</strong>{" "}
                          {isPremium
                            ? "ACTIVE"
                            : "BASIC"}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <button
                  className="account-primary-button"
                  type="button"
                  onClick={() => router.push("/premium")}
                >
                  Manage Subscription
                </button>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {section === "notifications" && (
              <div>
                <h2>Notifications</h2>

                <p className="account-description">
                  Control whether Ukti can send you notifications.
                </p>

                <div className="account-notification-row">
                  <div>
                    <strong>Notifications</strong>

                    <p>
                      {notifications
                        ? "Currently ON"
                        : "Currently OFF"}
                    </p>
                  </div>

                  <label className="account-switch">
                    <input
                      type="checkbox"
                      checked={notifications}
                      disabled={notificationLoading}
                      onChange={(e) =>
                        handleNotificationChange(e.target.checked)
                      }
                    />

                    <span className="account-switch-slider" />
                  </label>
                </div>
              </div>
            )}

            {/* DELETE ACCOUNT */}
            {section === "delete" && (
              <div>
                <h2>Delete Account</h2>

                <p className="account-description">
                  Permanently delete your Ukti account.
                </p>

                {!deleteConfirmation ? (
                  <>
                    <p>
                      Deleting your account is permanent. Your account
                      and associated data may be deleted.
                    </p>

                    <button
                      className="account-danger-button"
                      type="button"
                      onClick={() =>
                        setDeleteConfirmation(true)
                      }
                    >
                      Delete My Account
                    </button>
                  </>
                ) : (
                  <div className="account-delete-confirmation">
                    <h3>Are you sure?</h3>

                    <p>
                      This action cannot be undone. You will lose access
                      to your Ukti account.
                    </p>

                    <button
                      className="account-danger-button"
                      type="button"
                      disabled={deleting}
                      onClick={handleDeleteAccount}
                    >
                      {deleting
                        ? "Deleting..."
                        : "Confirm Permanent Deletion"}
                    </button>

                    <button
                      className="account-secondary-button"
                      type="button"
                      disabled={deleting}
                      onClick={() =>
                        setDeleteConfirmation(false)
                      }
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {message && (
              <p className="account-status-message" role="status">
                {message}
              </p>
            )}

          </section>
        </div>
      </div>
    </main>
  );
}
