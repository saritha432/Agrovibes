import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  createProviderRazorpayAccount,
  fetchProviderKycStatus,
  fetchProviderListings,
  verifyProviderBankAccount
} from "../../api/providerKyc";
import { readProviderDraft } from "./providerDraft";

const BANK_KEY = "cropvibe.provider.bank.v1";
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type SavedBank = {
  holderName: string;
  accountNumber: string;
  ifsc: string;
  razorpayAccountId?: string;
};

function readSavedBank(): SavedBank | null {
  try {
    const raw = sessionStorage.getItem(BANK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedBank;
    if (!parsed.accountNumber || !parsed.ifsc) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ProviderOverviewPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState("not_submitted");
  const [approvedListings, setApprovedListings] = useState(0);
  const [savedBank, setSavedBank] = useState<SavedBank | null>(() => readSavedBank());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [holderName, setHolderName] = useState("");
  const [account, setAccount] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const [kyc, listed] = await Promise.all([fetchProviderKycStatus(token), fetchProviderListings(token)]);
        if (!active) return;
        setStatus(kyc.status);
        setApprovedListings((listed.listings || []).filter((row) => row.status === "approved").length);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load provider setup.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!savedBank) return;
    setHolderName(savedBank.holderName);
    setAccount(savedBank.accountNumber);
    setConfirmAccount(savedBank.accountNumber);
    setIfsc(savedBank.ifsc);
  }, [savedBank]);

  const approved = status === "approved";
  const bankReady = Boolean(savedBank?.accountNumber);
  const payoutReady = Boolean(savedBank?.razorpayAccountId);
  const bookingsOn = approved && bankReady && payoutReady && approvedListings > 0;
  const accountDigits = account.replace(/\D/g, "");
  const confirmDigits = confirmAccount.replace(/\D/g, "");
  const ifscCode = ifsc.toUpperCase();
  const formReady =
    holderName.trim().length > 1 &&
    accountDigits.length >= 6 &&
    accountDigits === confirmDigits &&
    IFSC_PATTERN.test(ifscCode);

  const verifyBank = async () => {
    if (!token) return;
    if (accountDigits !== confirmDigits) {
      setError("The account numbers do not match.");
      return;
    }
    if (!IFSC_PATTERN.test(ifscCode)) {
      setError("Enter an 11-character IFSC, such as SBIN0001234.");
      return;
    }
    const draft = readProviderDraft();
    setBusy(true);
    setError("");
    try {
      const result = await verifyProviderBankAccount(token, {
        accountNumber: accountDigits,
        ifsc: ifscCode,
        applicantName: holderName.trim(),
        phone: draft.phone
      });
      if (!result.matched) {
        setError(`The bank account is in the name of ${result.holderName}. It does not match the verified Aadhaar name${result.aadhaarName ? `, ${result.aadhaarName}` : ""}.`);
        return;
      }
      const typed = holderName.trim().toLowerCase();
      const returned = result.holderName.trim().toLowerCase();
      if (typed && returned && !returned.includes(typed) && !typed.includes(returned)) {
        setError(`Bank records show ${result.holderName}. Enter that name, then verify again.`);
        return;
      }
      const next: SavedBank = {
        holderName: result.holderName,
        accountNumber: accountDigits,
        ifsc: ifscCode,
        razorpayAccountId: savedBank?.razorpayAccountId
      };
      const street = draft.street || draft.village;
      const city = draft.district || draft.village;
      if (draft.email && street && city && draft.state && pin.replace(/\D/g, "").length === 6) {
        const linked = await createProviderRazorpayAccount(token, {
          accountNumber: accountDigits,
          ifsc: ifscCode,
          holderName: result.holderName,
          email: draft.email,
          phone: draft.phone,
          businessName: draft.businessName || draft.fullName || result.holderName,
          street,
          city,
          state: draft.state,
          postalCode: pin.replace(/\D/g, "")
        });
        if (!linked.linked || !linked.accountId) {
          sessionStorage.setItem(BANK_KEY, JSON.stringify(next));
          setSavedBank(next);
          setError(linked.message || "The bank account was verified. Razorpay did not link an account yet.");
          return;
        }
        next.razorpayAccountId = linked.accountId;
      } else if (!next.razorpayAccountId) {
        sessionStorage.setItem(BANK_KEY, JSON.stringify(next));
        setSavedBank(next);
        setError("Bank account verified. Add the 6-digit PIN from your address so Razorpay can finish onboarding.");
        return;
      }
      sessionStorage.setItem(BANK_KEY, JSON.stringify(next));
      setSavedBank(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the bank account.");
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    {
      title: "Provider Registration",
      detail: "Individual / Business → DigiLocker → Admin approval",
      done: approved,
      state: approved ? "done" : status === "pending" ? "open" : "open"
    },
    {
      title: "Provider Dashboard Unlocked",
      detail: "Provider can add tractors and other equipment",
      done: approved,
      state: approved ? "done" : "locked"
    },
    {
      title: "Add Bank Account (One Time)",
      detail: payoutReady ? "Bank verified and Razorpay account linked." : bankReady ? "Bank verified. Razorpay onboarding is still open." : "Verify bank details and complete Razorpay onboarding",
      done: payoutReady,
      state: !approved ? "locked" : payoutReady ? "done" : "open"
    },
    {
      title: "Online Bookings Enabled",
      detail: bookingsOn ? "For approved equipment with availability" : "For approved equipment, after the bank and Razorpay checks succeed",
      done: bookingsOn,
      state: bookingsOn ? "done" : "locked"
    }
  ];

  return (
    <section className="provider-flow">
      {steps.map((step, index) => (
        <div key={step.title}>
          <article className={`provider-flow__card${step.done ? " is-done" : ""}`}>
            <strong>{step.done ? "✓ " : ""}{step.title}</strong>
            <span>{step.detail}</span>
          </article>
          {index < steps.length - 1 ? <div className="provider-flow__arrow" aria-hidden>↓</div> : null}
        </div>
      ))}

      {!approved ? (
        <Link className="provider-flow__link" to="/provider/join">
          {status === "pending" ? "Registration is with admin" : "Continue registration"}
        </Link>
      ) : (
        <Link className="provider-flow__link" to="/provider/listings/new">
          Add tractor or equipment
        </Link>
      )}

      {approved && !payoutReady ? (
        <form
          className="provider-bank"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyBank();
          }}
        >
          <h2>Add Bank Account</h2>
          <label>
            Account Holder Name
            <input value={holderName} onChange={(event) => setHolderName(event.target.value)} placeholder="Name as per bank records" />
          </label>
          <label>
            Bank Account Number
            <input value={account} onChange={(event) => setAccount(event.target.value.replace(/[^\d]/g, ""))} placeholder="Enter account number" inputMode="numeric" />
          </label>
          <label>
            Confirm Account Number
            <input value={confirmAccount} onChange={(event) => setConfirmAccount(event.target.value.replace(/[^\d]/g, ""))} placeholder="Re-enter account number" inputMode="numeric" />
          </label>
          <label>
            IFSC Code
            <input value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))} placeholder="e.g. SBIN0001234" />
          </label>
          <label>
            PIN code
            <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit PIN for Razorpay" inputMode="numeric" />
          </label>
          {error ? <p className="provider-bank__error">{error}</p> : null}
          <button type="submit" disabled={busy || !formReady}>
            {busy ? "Verifying…" : "Verify & Save Bank Account"}
          </button>
        </form>
      ) : null}
      {approved && payoutReady && error ? <p className="provider-bank__error">{error}</p> : null}
    </section>
  );
}
