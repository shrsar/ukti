
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");

  const router = useRouter();
  const supabase = createClient();

  // Password validation
  const passwordChecks = {
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    number: /[0-9]/.test(password),
    length: password.length >= 6,
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setVerificationEmail("");

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();

    if (!name || !email || !password) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage("Please meet all password requirements.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // Detect an existing email when Supabase returns
      // an empty identities array.
      if (data.user && data.user.identities?.length === 0) {
        setErrorMessage(
          "An account with this email already exists. Please sign in instead."
        );
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else if (data.user) {
        setVerificationEmail(email);
        setSuccessMessage(
          "Your account has been created successfully!"
        );
      } else {
        setErrorMessage(
          "Unable to create your account. Please try again."
        );
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (
    provider: "google" | "apple" | "azure"
  ) => {
    setErrorMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch {
      setErrorMessage("Unable to start social sign-up.");
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-page-card">
        <Link href="/" className="login-back">
          ← Back to Home
        </Link>

        <div className="login-page-content">
          <h1>Create your account</h1>

          <p className="login-page-subtitle">
            Start your language learning journey with KaKhaGaGha.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              required
              disabled={loading}
            />

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              required
              disabled={loading}
            />

            <label htmlFor="password">Password</label>

            <div className="password-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {/* Live password requirements */}
            <div className="password-requirements">
              <p>Password must contain:</p>

              <div className={passwordChecks.uppercase ? "requirement valid" : "requirement"}>
                {passwordChecks.uppercase ? "✓" : "○"} An uppercase letter (A–Z)
              </div>

              <div className={passwordChecks.lowercase ? "requirement valid" : "requirement"}>
                {passwordChecks.lowercase ? "✓" : "○"} A lowercase letter (a–z)
              </div>

              <div className={passwordChecks.special ? "requirement valid" : "requirement"}>
                {passwordChecks.special ? "✓" : "○"} A special symbol (!, @, #, etc.)
              </div>

              <div className={passwordChecks.number ? "requirement valid" : "requirement"}>
                {passwordChecks.number ? "✓" : "○"} A numeric character (0–9)
              </div>

              <div className={passwordChecks.length ? "requirement valid" : "requirement"}>
                {passwordChecks.length ? "✓" : "○"} At least 6 characters
              </div>
            </div>

            {errorMessage && (
              <p role="alert" style={{ color: "#c62828", fontSize: "13px" }}>
                {errorMessage}
              </p>
            )}

            {/* Email verification success message */}
            {successMessage && (
              <div className="verification-message" role="status">
                <div className="verification-icon">✉</div>

                <h3>Check your email!</h3>

                <p>{successMessage}</p>

                <p>
                  We sent a verification link to:
                  <strong> {verificationEmail}</strong>
                </p>

                <p className="verification-hint">
                  Open your inbox or spam folder and click the verification
                  link to activate your KaKhaGaGha account.
                </p>

                <Link href="/login" className="verification-login-link">
                  Go to Sign In
                </Link>
              </div>
            )}

            {!successMessage && (
              <button
                type="submit"
                className="login-submit"
                disabled={loading || !isPasswordValid}
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            )}
          </form>

          <div className="login-separator">
            <span />
            <p>or sign up with</p>
            <span />
          </div>

          <div className="social-buttons">
            {/* GOOGLE */}
            <button
              type="button"
              aria-label="Sign up with Google"
              disabled={loading}
              onClick={() => handleSocialSignup("google")}
            >
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7-10.1 7-17.5Z" />
                <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.1a24 24 0 0 0 0 21.4l7.9-6.1Z" />
                <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.9l-7.5-5.8c-2.1 1.4-4.9 2.2-8.5 2.2-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z" />
              </svg>
            </button>

            {/* APPLE */}
            <button
              type="button"
              aria-label="Sign up with Apple"
              disabled={loading}
              onClick={() => handleSocialSignup("apple")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M16.7 12.8c0-2.5 2-3.7 2.1-3.8a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3-.5 7.5 1.3 9.9.9 1.2 1.9 2.5 3.2 2.4 1.3-.1 1.8-.8 3.4-.8 1.6 0 2.1.8 3.4.8 1.4 0 2.2-1.2 3.1-2.5a11 11 0 0 0 1.4-2.8 4.3 4.3 0 0 1-3.1-3.7ZM14.2 5.4a4.4 4.4 0 0 0 1-3.2 4.5 4.5 0 0 0-2.9 1.5 4.1 4.1 0 0 0-1 3.1 3.8 3.8 0 0 0 2.9-1.4Z"
                />
              </svg>
            </button>

            {/* MICROSOFT */}
            <button
              type="button"
              aria-label="Sign up with Microsoft"
              disabled={loading}
              onClick={() => handleSocialSignup("azure")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#7FBA00" d="M13 1h10v10H13z" />
                <path fill="#00A4EF" d="M1 13h10v10H1z" />
                <path fill="#FFB900" d="M13 13h10v10H13z" />
              </svg>
            </button>
          </div>

          <p className="signup-prompt">
            Already have an account?{" "}
            <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
