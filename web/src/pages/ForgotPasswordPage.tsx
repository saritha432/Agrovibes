import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { resetPasswordWithOtp, sendPhoneOtp } from "../api/auth";
import "./LoginPage.css";

function sanitizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10);
}

function normalizePhone(raw: string) {
  const digits = sanitizePhone(raw);
  if (digits.length < 10) return null;
  return `+91${digits}`;
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "reset">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const onSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sendPhoneOtp({ phone: normalized });
      setPhone(normalized);
      setStep("reset");
      setCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!phone || submitting || countdown > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendPhoneOtp({ phone });
      setCountdown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const onReset = async (e: FormEvent) => {
    e.preventDefault();
    const otp = code.replace(/\D/g, "").slice(0, 6);
    if (otp.length !== 6) {
      setError("Enter a valid 6-digit OTP.");
      return;
    }
    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPasswordWithOtp({
        phone,
        code: otp,
        newPassword: password.trim()
      });
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const goLogin = () => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    navigate("/login", { replace: true, state: { resetOk: true, loginPhone: digits } });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/cropvibe.png" alt="Cropvibe" className="login-card__logo" />
        <h1 className="login-card__title">
          {step === "phone" ? "Forgot password" : "6 Digit Code"}
        </h1>
        {step === "reset" ? (
          <p className="login-card__subtitle">
            Reset password for {phone}
            <br />
            Use static OTP: 525252
          </p>
        ) : (
          <p className="login-card__subtitle">We will send an OTP to your mobile number.</p>
        )}

        {showSuccess ? (
          <div className="login-form__success">
            <p>Password reset successfully. You can log in with your new password.</p>
            <button type="button" onClick={goLogin}>
              Back to log in
            </button>
          </div>
        ) : step === "phone" ? (
          <form onSubmit={onSendOtp} className="login-form">
            <label className="login-form__label">
              Mobile number
              <span className="login-form__phone-row">
                <span className="login-form__country">🇮🇳 +91</span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(sanitizePhone(e.target.value))}
                  maxLength={10}
                  required
                />
              </span>
            </label>
            {error ? <p className="login-form__error">{error}</p> : null}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={onReset} className="login-form">
            <label className="login-form__label">
              OTP
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
            </label>
            <label className="login-form__label">
              New password
              <span className="login-form__password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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
            <label className="login-form__label">
              Confirm password
              <span className="login-form__password-wrap">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="login-form__password-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? (
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
              {submitting ? "Saving…" : "Reset password"}
            </button>
            <div className="login-form__resend">
              <span>{countdown > 0 ? `Resend in ${countdown}s` : "Resend the code?"}</span>
              <button type="button" disabled={submitting || countdown > 0} onClick={() => void onResend()}>
                Resend
              </button>
            </div>
          </form>
        )}

        {!showSuccess ? (
          <Link to="/login" className="login-card__toggle">
            Back to log in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
