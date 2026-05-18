import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!loading && token) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setError("Name is required.");
        return;
      }
      if (!username.trim()) {
        setError("Username is required.");
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
          ? await authLogin({ identifier: loginId.trim(), password: password.trim() })
          : await authRegister({
              email: email.trim().toLowerCase(),
              password: password.trim(),
              fullName: fullName.trim(),
              username: username.trim().toLowerCase(),
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
        <img src="/cropvibe.png" alt="Cropvibe" className="login-card__logo" />
        <h1 className="login-card__title">{mode === "login" ? "Log in" : "Create account"}</h1>

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
                Username
                <input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                  required
                  autoComplete="username"
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
              Email, username, or mobile
              <input
                type="text"
                placeholder="Email, username, or mobile"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                autoComplete="username"
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
                      fill="currentColor"
                      d="M11.83 9 15 12.17V12a3 3 0 0 0-3-3h-.17M7.53 9.8 3 14.33 4.67 16l4.24-4.24-1.41-1.41L7.53 9.8M2.81 2.81 1.39 4.22l2.05 2.05C2.73 7.61 1 10.5 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l2.42 2.42 1.41-1.41L2.81 2.81M12 4.5c5 0 9.27 3.11 11 7.5-.64 1.63-1.56 3.09-2.7 4.31l1.41 1.41C22.27 15.39 23 13.76 23 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-4 .71l1.55 1.55c.79-.15 1.6-.26 2.45-.26z"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M12 6.5c3.79 0 7.17 2.13 8.82 5.5-1.65 3.37-5.03 5.5-8.82 5.5S4.83 15.37 3.18 12C4.83 8.63 8.21 6.5 12 6.5m0-2C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5m0-2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"
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

        <button
          type="button"
          className="login-card__toggle"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setShowPassword(false);
          }}
        >
          {mode === "login" ? "Create an account" : "Already have an account?"}
        </button>
      </div>
    </div>
  );
}
