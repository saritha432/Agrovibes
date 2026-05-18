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
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
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
          }}
        >
          {mode === "login" ? "Create an account" : "Already have an account?"}
        </button>
      </div>
    </div>
  );
}
