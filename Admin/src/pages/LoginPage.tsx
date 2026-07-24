import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { adminLogin } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import "./LoginPage.css";

export function LoginPage() {
  const { token, signIn, loading } = useAuth();
  const [email, setEmail] = useState("info@cropvibe.com");
  const [password, setPassword] = useState("Cropvibe@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && token) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminLogin({ email: email.trim(), password: password.trim() });
      signIn({ token: res.token, user: res.user });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (/invalid credentials/i.test(msg)) {
        setError(
          "Invalid credentials — this admin user is missing on the server DB. Run Admin/scripts/create-admin.sql in Supabase, then try again."
        );
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login__main">
        <section className="admin-login__brand" aria-hidden={false}>
          <img
            className="admin-login__brand-logo"
            src="/assets/companyplaceholder.png"
            alt=""
          />
          <h1 className="admin-login__headline">Make the world&apos;s products bigger and better</h1>
          <div className="admin-login__art">
            <img
              className="admin-login__art-img"
              src="/assets/leftside.png"
              alt=""
              width={420}
              height={280}
            />
          </div>
        </section>

        <section className="admin-login__panel">
          <h2 className="admin-login__title">Log in to cropvibe</h2>

          <form className="admin-login__form" onSubmit={onSubmit} noValidate>
            {error ? <p className="admin-login__error">{error}</p> : null}

            <label className="admin-login__label" htmlFor="admin-email">
              Email address
            </label>
            <input
              id="admin-email"
              className="admin-login__input"
              type="email"
              autoComplete="email"
              placeholder="jane.doe@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="admin-login__label" htmlFor="admin-password">
              Password
            </label>
            <div className="admin-login__password-wrap">
              <input
                id="admin-password"
                className="admin-login__input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="admin-login__eye"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                    <path d="M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7.5a11.4 11.4 0 01-4.1 5.1" />
                    <path d="M6.1 6.1A11.4 11.4 0 001 12.5C2.7 16.9 7 20 12 20a9.7 9.7 0 005.1-1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5z" />
                    <circle cx="12" cy="12.5" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button className="admin-login__submit" type="submit" disabled={submitting}>
              {submitting ? "Logging in…" : "Login"}
            </button>
          </form>

          <div className="admin-login__links">
            <button type="button" className="admin-login__text-link" disabled title="Coming soon">
              Forgot password?
            </button>
            <button type="button" className="admin-login__text-link" disabled title="Admin invites only">
              Create an account
            </button>
          </div>

          <div className="admin-login__divider">
            <span />
            <em>or</em>
            <span />
          </div>

          <div className="admin-login__social">
            <button type="button" className="admin-login__social-btn admin-login__social-btn--google" disabled title="Coming soon">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.8c2.3-2.1 3.6-5.2 3.6-8.8z" />
                <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-3c-1.1.7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
                <path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.4-.4-2.3s.1-1.6.4-2.3V6.6H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.4l3.9-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l3.9 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
              </svg>
            </button>
            <button type="button" className="admin-login__social-btn admin-login__social-btn--apple" disabled title="Coming soon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
                <path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.7-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2-.1 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.4-3.7zM14.2 6.3c.6-.8 1.1-1.8 1-2.9-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.8 1.1.1 2.2-.5 2.9-1.4z" />
              </svg>
            </button>
            <button type="button" className="admin-login__social-btn admin-login__social-btn--facebook" disabled title="Coming soon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
                <path d="M14 8.2V6.4c0-.6.1-1 .9-1H16V3h-2.2C11.3 3 10 4.5 10 6.8v1.4H8v2.7h2V21h3.2v-9.9h2.2l.6-2.9H13.2z" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      <footer className="admin-login__footer">
        <div className="admin-login__footer-inner">
          <span className="admin-login__footer-brand">CROPVIBE</span>
          <nav className="admin-login__footer-nav">
            <span>Copyright {new Date().getFullYear()}</span>
            <Link to="https://cropvibe.com/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </Link>
            <Link to="https://cropvibe.com" target="_blank" rel="noreferrer">
              Contact Us
            </Link>
          </nav>
          <p className="admin-login__footer-craft">
            Crafted with <span aria-hidden="true">♥</span> in Hyderabad, India
          </p>
        </div>
      </footer>
    </div>
  );
}
