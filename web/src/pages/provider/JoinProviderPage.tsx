import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchProviderDigilockerResult,
  startProviderDigilocker,
  submitProviderKyc,
  verifyProviderBankAccount,
  verifyProviderPan
} from "../../api/providerKyc";
import { SettingsIconBack } from "../../components/settings/SettingsIcons";
import "../settings/SettingsMenuPage.css";
import {
  readProviderDraft,
  writeProviderDraft,
  type ProviderJoinDraft,
  type ProviderRegistrationType,
  type ProviderTrack
} from "./providerDraft";
import "./JoinProviderPage.css";

type Step = "intro" | "terms" | "role" | "type" | "details" | "aadhaar" | "pan" | "bank" | "review" | "done";

const TERMS = [
  {
    title: "1. Eligibility",
    body: [
      "By registering as a Rental Provider, you confirm that you are at least 18 years old and legally authorized to rent out agricultural machinery, equipment, vehicles, or provide related services."
    ]
  },
  {
    title: "2. Services You Can Offer",
    body: [
      "Rental Providers may list:",
      "Tractors and harvesters",
      "Agricultural machinery and equipment",
      "Drivers/operators",
      "Agricultural labor services",
      "Other approved farming-related rental services"
    ]
  },
  {
    title: "3. Accurate Information",
    body: [
      "You agree to provide accurate and up-to-date information, including:",
      "Name and contact details",
      "Equipment details and condition",
      "Rental pricing",
      "Availability schedule",
      "DigiLocker Aadhaar, PAN matched to that identity, and a verified bank account"
    ]
  }
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePan(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function JoinProviderPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [step, setStep] = useState<Step>("intro");
  const [termsPage, setTermsPage] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [draft, setDraft] = useState<ProviderJoinDraft>(() => readProviderDraft());
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kycStatus, setKycStatus] = useState<"idle" | "pending" | "verified" | "failed">(
    readProviderDraft().digilockerVerified ? "verified" : "idle"
  );
  const [ifscDetails, setIfscDetails] = useState(true);
  const [panFullName, setPanFullName] = useState(readProviderDraft().aadhaarName || readProviderDraft().fullName);
  const [panDob, setPanDob] = useState("");
  const [panMatch, setPanMatch] = useState<{ panName: string; aadhaarName: string; matched: boolean } | null>(
    readProviderDraft().panMatched
      ? { panName: readProviderDraft().panName, aadhaarName: readProviderDraft().aadhaarName, matched: true }
      : null
  );
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    writeProviderDraft(draft);
  }, [draft]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const patch = (next: Partial<ProviderJoinDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const goBack = () => {
    setError("");
    if (step === "intro") navigate("/settings");
    else if (step === "terms") {
      if (termsPage === 2) setTermsPage(1);
      else setStep("intro");
    } else if (step === "role") setStep("terms");
    else if (step === "type") setStep("role");
    else if (step === "details") setStep("type");
    else if (step === "aadhaar") setStep("details");
    else if (step === "pan") setStep("aadhaar");
    else if (step === "bank") setStep("pan");
    else if (step === "review") setStep("bank");
    else navigate("/settings");
  };

  const isBusiness = draft.registrationType === "business";
  const emailOk = !draft.email.trim() || isValidEmail(draft.email);
  const detailsOk = isBusiness
    ? draft.businessName.trim().length > 1 &&
      draft.fullName.trim().length > 1 &&
      draft.phone.trim().length >= 10 &&
      isValidEmail(draft.email) &&
      draft.street.trim().length > 0 &&
      draft.village.trim().length > 0 &&
      draft.district.trim().length > 0 &&
      draft.state.trim().length > 0
    : draft.fullName.trim().length > 1 &&
      draft.phone.trim().length >= 10 &&
      draft.village.trim().length > 0 &&
      draft.district.trim().length > 0 &&
      draft.state.trim().length > 0 &&
      emailOk;
  const panOk = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(draft.panNumber);
  const ifscOk = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(draft.ifsc);
  const accountOk = draft.accountNumber.replace(/\D/g, "").length >= 6;

  const startDigilocker = async () => {
    if (!token || busy || draft.digilockerVerified) return;
    setBusy(true);
    setError("");
    setKycStatus("idle");
    try {
      const started = await startProviderDigilocker(token, {
        fullName: draft.fullName,
        phone: draft.phone
      });
      setKycStatus("pending");
      setGatewayUrl(started.gatewayUrl);
      const popup = window.open(started.gatewayUrl, "cropvibe-digilocker", "width=480,height=760");
      if (!popup) {
        setError("Allow pop-ups, or use the DigiLocker link below.");
      }
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const next = await fetchProviderDigilockerResult(token, started.sessionId);
            if (next.status === "failed") {
              if (pollRef.current) window.clearInterval(pollRef.current);
              setKycStatus("failed");
              setError(next.message || "DigiLocker verification failed.");
              return;
            }
            if (next.status === "verified" && next.name) {
              if (pollRef.current) window.clearInterval(pollRef.current);
              setKycStatus("verified");
              patch({
                digilockerVerified: true,
                aadhaarName: next.name,
                aadhaarMasked: next.maskedAadhaar || "",
                panMatched: false,
                panName: "",
                bankVerified: false,
                holderName: ""
              });
              setPanMatch(null);
              popup?.close();
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not read DigiLocker result.");
          }
        })();
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start DigiLocker.");
    } finally {
      setBusy(false);
    }
  };

  const panFormOk = panOk && panFullName.trim().length > 2 && Boolean(panDob);
  const verifyPan = async () => {
    if (!token || !panFormOk || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyProviderPan(token, {
        panNumber: draft.panNumber,
        fullName: panFullName.trim(),
        dob: panDob
      });
      setPanMatch({ panName: result.panName, aadhaarName: result.aadhaarName, matched: result.matched });
      patch({
        panNumber: result.pan,
        panName: result.panName,
        panMatched: result.matched,
        bankVerified: false,
        holderName: ""
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify PAN.");
    } finally {
      setBusy(false);
    }
  };

  const verifyBank = async () => {
    if (!token || !accountOk || !ifscOk || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyProviderBankAccount(token, {
        accountNumber: draft.accountNumber.replace(/\D/g, ""),
        ifsc: draft.ifsc,
        ifscDetails
      });
      patch({
        holderName: result.holderName,
        bankName: result.bankName || draft.bankName,
        bankBranch: result.bankBranch || draft.bankBranch,
        bankVerified: result.matched
      });
      if (!result.matched) setError("Account holder name does not match the Aadhaar name.");
    } catch (err) {
      patch({ bankVerified: false, holderName: "" });
      setError(err instanceof Error ? err.message : "Could not verify the bank account.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!token || busy) return;
    if (!draft.digilockerVerified || !draft.panMatched || !draft.bankVerified || !draft.panNumber) {
      setError("Complete DigiLocker, PAN match, and bank verification before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const address = [draft.street, draft.village, draft.district, draft.state].filter(Boolean).join(", ");
      await submitProviderKyc(token, {
        applicantName: draft.fullName || "Provider",
        role: draft.track,
        registrationType: draft.registrationType,
        documentSummary: "DigiLocker Aadhaar, PAN, and bank verified",
        documents: [],
        businessName: draft.businessName || undefined,
        gstNumber: draft.gstNumber || undefined,
        email: draft.email || undefined,
        phone: draft.phone || undefined,
        address: address || undefined,
        priority: "Medium",
        otpVerified: true,
        panNumber: draft.panNumber
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit KYC.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-provider">
      <header className="settings-topbar">
        <button type="button" className="settings-topbar__back" onClick={goBack} aria-label="Back">
          <SettingsIconBack />
        </button>
        <h1 className="settings-topbar__title">
          {step === "intro" ? "Join As Provider" : step === "terms" ? "Terms And Condition" : "Provider Verification"}
        </h1>
        <span className="settings-topbar__spacer" />
      </header>

      <div className="join-provider__body">
        {step === "intro" ? (
          <section className="join-card">
            <p className="join-kicker">Rent It. Service It. Earn</p>
            <h2>Become a Provider</h2>
            <p>
              Basic details, DigiLocker Aadhaar, PAN match, then bank account verification. Admin reviews the
              application after you submit.
            </p>
            <button type="button" className="join-btn" onClick={() => setStep("terms")}>
              Become A Provider
            </button>
          </section>
        ) : null}

        {step === "terms" ? (
          <section className="join-card">
            <p className="join-kicker">Rental Provider</p>
            {TERMS.map((section) => (
              <div key={section.title}>
                <h3>{section.title}</h3>
                {section.body
                  .filter(
                    (line) =>
                      termsPage === 2 ||
                      (!line.startsWith("Availability") && !line.startsWith("DigiLocker"))
                  )
                  .map((line) => (
                    <p key={line}>{line}</p>
                  ))}
              </div>
            ))}
            {termsPage === 2 ? (
              <label className="join-check">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                I agree to the Rental Provider Terms & Conditions and accept all responsibilities.
              </label>
            ) : null}
            {termsPage === 1 ? (
              <button type="button" className="join-btn" onClick={() => setTermsPage(2)}>
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="join-btn"
                disabled={!accepted}
                onClick={() => setStep("role")}
              >
                Accept And Join As Provider
              </button>
            )}
          </section>
        ) : null}

        {step === "role" ? (
          <section>
            <h2 className="join-title">
              What Would You <span>Like To Offer?</span>
            </h2>
            <p className="join-sub">Pick a track to begin. You can add a second role later from your dashboard.</p>
            {(
              [
                ["service", "Service Provider", "Offer expert services like soil testing, repairs, or technical support."],
                ["rental", "Rental Provider", "Rent out machinery, labour, drivers, vehicles, or warehouse space."],
                ["both", "Rental & Service", "Complete both registrations now for equipment and other services."]
              ] as const
            ).map(([id, title, subtitle]) => (
              <button
                key={id}
                type="button"
                className={`join-option${draft.track === id ? " join-option--active" : ""}`}
                onClick={() => patch({ track: id as ProviderTrack })}
              >
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </button>
            ))}
            <button type="button" className="join-btn" onClick={() => setStep("type")}>
              Continue
            </button>
          </section>
        ) : null}

        {step === "type" ? (
          <section>
            <h2 className="join-title">
              Registration <span>Type</span>
            </h2>
            <p className="join-sub">Are you registering as an individual or as a business / company?</p>
            {(
              [
                ["individual", "Individual", "Basic details, DigiLocker Aadhaar, PAN, then bank verification."],
                ["business", "Business / Company", "Business details, DigiLocker Aadhaar, PAN, then bank verification."]
              ] as const
            ).map(([id, title, subtitle]) => (
              <button
                key={id}
                type="button"
                className={`join-option${draft.registrationType === id ? " join-option--active" : ""}`}
                onClick={() => patch({ registrationType: id as ProviderRegistrationType })}
              >
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </button>
            ))}
            <button type="button" className="join-btn" onClick={() => setStep("details")}>
              Continue
            </button>
          </section>
        ) : null}

        {step === "details" ? (
          <section>
            <h2 className="join-title">Basic Details</h2>
            <p className="join-sub">
              {isBusiness ? "Name, phone, email, address, and business details" : "Name, phone, email, and address"}
            </p>
            {isBusiness ? (
              <input
                className="join-input"
                placeholder="Business Name *"
                value={draft.businessName}
                onChange={(event) => patch({ businessName: event.target.value })}
              />
            ) : null}
            <input
              className="join-input"
              placeholder={isBusiness ? "Authorized Person Name *" : "Full Name (As per Aadhaar) *"}
              value={draft.fullName}
              onChange={(event) => patch({ fullName: event.target.value })}
            />
            <input
              className="join-input"
              placeholder="Mobile Number *"
              value={draft.phone}
              onChange={(event) => patch({ phone: event.target.value })}
            />
            <input
              className="join-input"
              placeholder={isBusiness ? "Email Address *" : "Email Address (optional)"}
              value={draft.email}
              onChange={(event) => patch({ email: event.target.value })}
            />
            {isBusiness ? (
              <input
                className="join-input"
                placeholder="Street / House No. *"
                value={draft.street}
                onChange={(event) => patch({ street: event.target.value })}
              />
            ) : (
              <h3 className="join-location">Location</h3>
            )}
            <input
              className="join-input"
              placeholder="Village / Town *"
              value={draft.village}
              onChange={(event) => patch({ village: event.target.value })}
            />
            <input
              className="join-input"
              placeholder="District *"
              value={draft.district}
              onChange={(event) => patch({ district: event.target.value })}
            />
            <input
              className="join-input"
              placeholder="State *"
              value={draft.state}
              onChange={(event) => patch({ state: event.target.value })}
            />
            {isBusiness ? (
              <>
                <input
                  className="join-input"
                  placeholder="GST Number (if applicable)"
                  value={draft.gstNumber}
                  onChange={(event) => patch({ gstNumber: event.target.value.toUpperCase() })}
                />
                <input
                  className="join-input"
                  placeholder="Years of Experience"
                  value={draft.yearsExperience}
                  onChange={(event) => patch({ yearsExperience: event.target.value })}
                />
              </>
            ) : null}
            <button type="button" className="join-btn" disabled={!detailsOk} onClick={() => setStep("aadhaar")}>
              Continue
            </button>
          </section>
        ) : null}

        {step === "aadhaar" ? (
          <section className="aadhaar-card">
            <div className="aadhaar-card__head">
              <strong>Provider Verification</strong>
              <span className={kycStatus === "failed" ? "aadhaar-badge aadhaar-badge--failed" : "aadhaar-badge"}>
                {kycStatus === "failed" ? "Failed" : "Pending"}
              </span>
            </div>
            <div className="aadhaar-card__step">
              <strong>Aadhaar Verification</strong>
              <span>Step 1 of 3</span>
            </div>
            <div className="aadhaar-track">
              <div />
            </div>
            <p className="aadhaar-lead">Verify your identity</p>
            <p className="aadhaar-copy">
              Securely verify your Aadhaar using DigiLocker to continue provider registration.
            </p>
            <button
              type="button"
              className="aadhaar-btn"
              disabled={busy || draft.digilockerVerified}
              onClick={() => {
                void startDigilocker();
              }}
            >
              {busy ? "Starting…" : draft.digilockerVerified ? "Aadhaar Verified" : "Verify with DigiLocker"}
            </button>
            <p className={draft.digilockerVerified ? "aadhaar-ok" : "aadhaar-next"}>
              After successful verification: Aadhaar Verified
              {draft.digilockerVerified && draft.aadhaarName
                ? ` — ${draft.aadhaarName}${draft.aadhaarMasked ? ` · ${draft.aadhaarMasked}` : ""}`
                : ""}
            </p>
            <button
              type="button"
              className="aadhaar-next-btn"
              disabled={!draft.digilockerVerified}
              onClick={() => setStep("pan")}
            >
              Next: PAN and Bank Account Verification
            </button>
            {gatewayUrl && !draft.digilockerVerified ? (
              <a className="aadhaar-link" href={gatewayUrl} target="_blank" rel="noreferrer">
                Open DigiLocker
              </a>
            ) : null}
          </section>
        ) : null}

        {step === "pan" ? (
          <section className="pan-card">
            <h2>PAN Verify</h2>
            <p className="pan-step">Step 2 of 3. Match the PAN, name, and date of birth.</p>
            <label className="pan-label" htmlFor="pan-number">
              PAN Number
            </label>
            <input
              id="pan-number"
              className="pan-input"
              value={draft.panNumber}
              maxLength={10}
              onChange={(event) => {
                patch({ panNumber: normalizePan(event.target.value), panMatched: false });
                setPanMatch(null);
              }}
            />
            <label className="pan-label" htmlFor="pan-name">
              Full Name
            </label>
            <input
              id="pan-name"
              className="pan-input"
              value={panFullName}
              onChange={(event) => {
                setPanFullName(event.target.value);
                patch({ panMatched: false });
                setPanMatch(null);
              }}
            />
            <label className="pan-label" htmlFor="pan-dob">
              DOB
            </label>
            <input
              id="pan-dob"
              className="pan-input"
              type="date"
              value={panDob}
              onChange={(event) => {
                setPanDob(event.target.value);
                patch({ panMatched: false });
                setPanMatch(null);
              }}
            />
            <div className="pan-actions">
              <button type="button" className="pan-submit" disabled={!panFormOk || busy} onClick={() => void verifyPan()}>
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
            {panMatch ? (
              <p className={panMatch.matched ? "pan-ok" : "pan-bad"}>
                {panMatch.matched
                  ? `Matched with Aadhaar name ${panMatch.aadhaarName}`
                  : "PAN name or date of birth does not match Aadhaar."}
              </p>
            ) : null}
            <button
              type="button"
              className="pan-continue"
              disabled={!draft.panMatched}
              onClick={() => setStep("bank")}
            >
              Continue
            </button>
          </section>
        ) : null}

        {step === "bank" ? (
          <section className="pan-card">
            <h2>Bank Account</h2>
            <p className="pan-step">Step 3 of 3. Request parameters</p>
            <label className="pan-label" htmlFor="bank-id">
              ID Number
            </label>
            <input
              id="bank-id"
              className="pan-input"
              inputMode="numeric"
              value={draft.accountNumber}
              onChange={(event) =>
                patch({ accountNumber: event.target.value.replace(/\D/g, ""), bankVerified: false, holderName: "" })
              }
            />
            <label className="pan-label" htmlFor="bank-ifsc">
              IFSC
            </label>
            <input
              id="bank-ifsc"
              className="pan-input"
              value={draft.ifsc}
              maxLength={11}
              onChange={(event) => {
                const ifsc = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
                patch({ ifsc, bankVerified: false, holderName: "" });
              }}
            />
            <label className="pan-check">
              <input
                type="checkbox"
                checked={ifscDetails}
                onChange={(event) => setIfscDetails(event.target.checked)}
              />
              IFSC Details
            </label>
            <div className="pan-actions">
              <button
                type="button"
                className="pan-submit"
                disabled={!accountOk || !ifscOk || busy}
                onClick={() => void verifyBank()}
              >
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
            {draft.holderName ? (
              <p className={draft.bankVerified ? "pan-ok" : "pan-bad"}>
                {draft.bankVerified
                  ? `Account holder ${draft.holderName} matches Aadhaar.`
                  : `Account holder ${draft.holderName} does not match Aadhaar.`}
                {draft.bankName ? ` ${draft.bankName}${draft.bankBranch ? `, ${draft.bankBranch}` : ""}` : ""}
              </p>
            ) : null}
            <button
              type="button"
              className="pan-continue"
              disabled={!draft.bankVerified}
              onClick={() => setStep("review")}
            >
              Continue
            </button>
          </section>
        ) : null}

        {step === "review" ? (
          <section className="join-card">
            <h2>Identity checks complete</h2>
            <p>
              DigiLocker Aadhaar, PAN, and the bank account holder are verified. Submit to send this application for
              admin review.
            </p>
            <button type="button" className="join-btn" disabled={busy} onClick={() => void submit()}>
              {busy ? "Submitting…" : "Submit For Approval"}
            </button>
          </section>
        ) : null}

        {step === "done" ? (
          <section className="join-card">
            <h2>Submitted For Approval</h2>
            <p>Admin has been notified. Your KYC will appear in Admin → KYC Verification for approval.</p>
            <button type="button" className="join-btn" onClick={() => navigate("/settings")}>
              Back to settings
            </button>
          </section>
        ) : null}

        {error ? <p className="join-error">{error}</p> : null}
      </div>
    </div>
  );
}
