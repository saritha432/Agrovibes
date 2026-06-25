import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { authLogin, authRegister } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import "./LoginPage.css";

function normalizePhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `+91${digits.slice(-10)}`;
}

export function LoginPage() {
  const { token, signIn, loading } = useAuth();
  const location = useLocation();
  const resetState = location.state as { resetOk?: boolean; loginPhone?: string } | null;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginMobile, setLoginMobile] = useState(() => resetState?.loginPhone || "");
  const [successText, setSuccessText] = useState(
    resetState?.resetOk ? "Password reset successfully. Log in with your new password." : ""
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!loading && token) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedLoginPhone = mode === "login" ? normalizePhoneInput(loginMobile) : null;
    if (mode === "login" && !normalizedLoginPhone) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setError("Name is required.");
        return;
      }
      if (!email.trim()) {
        setError("Email is required.");
        return;
      }
      const normalizedPhone = normalizePhoneInput(phone);
      if (!normalizedPhone) {
        setError("Enter a valid 10-digit mobile number.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res =
        mode === "login"
          ? await authLogin({ identifier: normalizedLoginPhone!, password: password.trim() })
          : await authRegister({
              email: email.trim().toLowerCase(),
              password: password.trim(),
              fullName: fullName.trim(),
              phone: normalizePhoneInput(phone)!,
              role: "student"
            });
      signIn({ token: res.token, user: res.user });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/logo-wordmark.png" alt="Cropvibe" className="login-card__logo login-card__logo--wordmark" />
        <h1 className="login-card__title">{mode === "login" ? "Log in" : "Create account"}</h1>

        {successText ? <p className="login-form__banner">{successText}</p> : null}

        <form onSubmit={onSubmit} className="login-form">
          {mode === "register" ? (
            <>
              <label className="login-form__label">
                Name
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="login-form__label">
                Mobile number
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </label>
              <label className="login-form__label">
                Email
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
            </>
          ) : (
            <label className="login-form__label">
              Mobile
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Mobile"
                value={loginMobile}
                onChange={(e) => setLoginMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                required
                autoComplete="tel"
              />
            </label>
          )}

          <label className="login-form__label">
            Password
            <span className="login-form__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="login-form__password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <path
                      d="M3 3l18 18M10.58 10.58A2 2 0 0010 12a2 2 0 003.42 1.42M9.9 4.24A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 7.5a11.8 11.8 0 01-3.04 4.36M6.23 6.23A11.77 11.77 0 001 11.5C2.73 15.89 7 19 12 19c1.61 0 3.14-.32 4.53-.9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <path
                      d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Zm11-3.5A3.5 3.5 0 1012 15.5 3.5 3.5 0 0012 8.5Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </span>
          </label>

          {error ? <p className="login-form__error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        {mode === "login" ? (
          <Link to="/forgot-password" className="login-card__toggle login-card__toggle--left">
            Forgot password?
          </Link>
        ) : null}

        <button
          type="button"
          className="login-card__toggle"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setSuccessText("");
            setShowPassword(false);
            setPassword("");
          }}
        >
          {mode === "login" ? "Create an account" : "Already have an account?"}
        </button>
      </div>
    </div>
  );
}
