
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileMenu() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const router = useRouter();

  // Get logged-in user and listen for authentication changes
  useEffect(() => {
    let active = true;

    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (active && !error) {
        setUser(data.user);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // User name and initials
  const name =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const initials = name
    .trim()
    .split(/\s+/)
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Toggle dropdown
  const handleProfileClick = () => {
    setOpen((current) => !current);
  };

  // Open login page
  const handleLogin = () => {
    setOpen(false);
    router.push("/login");
  };

  // Open My Account page
  const handleAccount = () => {
    setOpen(false);
    router.push("/account");
  };

  // Open Premium page
  const handlePremium = () => {
    setOpen(false);
    router.push("/premium");
  };

  // Sign out
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed:", error.message);
      return;
    }

    setUser(null);
    setOpen(false);

    router.replace("/");
    router.refresh();
  };

  return (
    <div className="profile-menu-container">

      {/* PROFILE BUTTON */}
      <button
        type="button"
        className="profile-button"
        onClick={handleProfileClick}
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="true"
        title={user ? name : "Profile"}
        style={{
          touchAction: "manipulation",
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      >
        {user ? (
          <span className="profile-initials">
            {initials}
          </span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle
              cx="12"
              cy="8"
              r="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />

            <path
              d="M5 20c.5-3.5 3.2-5.5 7-5.5s6.5 2 7 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* DROPDOWN MENU */}
      {open && (
        <div
          className="profile-dropdown"
          onPointerUp={(event) => event.stopPropagation()}
        >
          {user ? (
            <>
              <div className="profile-dropdown-user">
                <strong>{name}</strong>
                <small>{user.email}</small>
              </div>

              <button
                type="button"
                className="profile-dropdown-item"
                onClick={handleAccount}
              >
                My Account
              </button>

              <button
                type="button"
                className="profile-dropdown-item"
                onClick={handlePremium}
              >
                Buy Premium
              </button>

              <button
                type="button"
                className="profile-dropdown-item signout-item"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="profile-dropdown-item"
              onClick={handleLogin}
            >
              Login
            </button>
          )}
        </div>
      )}

    </div>
  );
}
