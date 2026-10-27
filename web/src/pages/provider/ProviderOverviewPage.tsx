import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  createProviderRazorpayAccount,
  fetchProviderKycStatus,
  fetchProviderListings,
  submitProviderListing,
  verifyProviderBankAccount
} from "../../api/providerKyc";
import { readProviderDraft } from "./providerDraft";

const RC_PATTERN = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export function ProviderOverviewPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState("not_submitted");
  const [hasRc, setHasRc] = useState(false);
  const [bankReady, setBankReady] = useState(false);
  const [payoutReady, setPayoutReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tractor, setTractor] = useState("");
  const [hp, setHp] = useState("");
  const [rate, setRate] = useState("");
  const [rc, setRc] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [pin, setPin] = useState("");
  const [holder, setHolder] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const [kyc, listed] = await Promise.all([fetchProviderKycStatus(token), fetchProviderListings(token)]);
        if (!active) return;
        setStatus(kyc.status);
        setHasRc((listed.listings || []).some((row) => Boolean(row.rcNumber)));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load provider setup.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  const draft = readProviderDraft();
  const submitted = status === "pending" || status === "approved" || status === "rejected";
  const identityReady = submitted || (draft.phoneOtpVerified && draft.digilockerVerified);
  const businessReady = submitted || draft.registrationType !== "business" || draft.panMatched || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(draft.gstNumber);
  const approved = status === "approved";
  const steps = [
    { title: "Provider registration", detail: "Mobile OTP, then DigiLocker Aadhaar.", done: identityReady },
    { title: "Business registration", detail: draft.registrationType === "business" ? "PAN or GST, as applicable." : "Not required for an individual.", done: businessReady },
    { title: "Admin approval", detail: approved ? "KYC approved." : status === "pending" ? "Waiting for admin review." : "Submit identity for review.", done: approved },
    { title: "Add tractor", detail: hasRc ? "RC submitted for review." : "Tractor details and RC number.", done: hasRc },
    { title: "Activate online bookings", detail: "Bank account, IFSC, and account holder verification.", done: bankReady },
    { title: "Receive payments", detail: payoutReady ? "Razorpay account linked." : "Razorpay linked account, after the bank is verified.", done: payoutReady }
  ];

  const saveTractor = async () => {
    if (!token) return;
    const rcNumber = rc.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (tractor.trim().length < 2 || !RC_PATTERN.test(rcNumber)) {
      setError("Enter the tractor name and a registration number such as TS09AB1234.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitProviderListing(token, {
        title: tractor.trim(),
        category: [hp.trim() ? `Tractor ${hp.trim()} HP` : "Tractor", rate.trim() ? `Rs ${rate.trim()}/day` : ""].filter(Boolean).join(" · "),
        channel: "Rental",
        rcNumber
      });
      setHasRc(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the tractor.");
    } finally {
      setBusy(false);
    }
  };

  const verifyBank = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyProviderBankAccount(token, {
        accountNumber: account.replace(/\D/g, ""),
        ifsc: ifsc.toUpperCase(),
        applicantName: draft.fullName || "Provider",
        phone: draft.phone
      });
      if (!result.matched) {
        setError(`Bank name is ${result.holderName}. It does not match ${result.aadhaarName}.`);
        setBankReady(false);
        return;
      }
      setHolder(result.holderName);
      setBankReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify the bank account.");
    } finally {
      setBusy(false);
    }
  };

  const linkRazorpay = async () => {
    if (!token) return;
    const street = draft.street || draft.village;
    const city = draft.district || draft.village;
    if (!draft.email || !street || !city || !draft.state || pin.replace(/\D/g, "").length !== 6) {
      setError("Email, address, and a 6-digit PIN code are required. Razorpay is not linked until it accepts them.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await createProviderRazorpayAccount(token, {
        accountNumber: account.replace(/\D/g, ""),
        ifsc: ifsc.toUpperCase(),
        holderName: holder || draft.fullName,
        email: draft.email,
        phone: draft.phone,
        businessName: draft.businessName || draft.fullName,
        street,
        city,
        state: draft.state,
        postalCode: pin.replace(/\D/g, "")
      });
      if (!result.linked || !result.accountId) {
        setError(result.message || "Razorpay did not link an account.");
        return;
      }
      setPayoutReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Razorpay is not ready.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="provider-panel">
      <h1>Provider setup</h1>
      <p>Finish each step in order. A later step stays closed until the one before it is done.</p>
      {error ? <p className="provider-error">{error}</p> : null}
      {steps.map((step, index) => {
        const locked = steps.slice(0, index).some((item) => !item.done);
        return (
          <div className="provider-step" key={step.title}>
            <strong>{locked ? "Locked" : step.done ? "Done" : "Open"} · {step.title}</strong>
            <span>{locked ? "Complete the previous step first." : step.detail}</span>
          </div>
        );
      })}
      {!identityReady || !businessReady || !approved ? <Link className="provider-lime-btn" to="/provider/join">Continue registration</Link> : null}
      {approved && !hasRc ? (
        <form className="provider-form" onSubmit={(event) => { event.preventDefault(); void saveTractor(); }}>
          <input value={tractor} onChange={(event) => setTractor(event.target.value)} placeholder="Tractor name" />
          <input value={hp} onChange={(event) => setHp(event.target.value)} placeholder="HP" />
          <input value={rate} onChange={(event) => setRate(event.target.value)} placeholder="Daily rate" />
          <input value={rc} onChange={(event) => setRc(event.target.value.toUpperCase())} placeholder="RC number" />
          <button className="provider-lime-btn" type="submit" disabled={busy}>Submit RC for review</button>
        </form>
      ) : null}
      {approved && hasRc && !bankReady ? (
        <form className="provider-form" onSubmit={(event) => { event.preventDefault(); void verifyBank(); }}>
          <input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="Account number" />
          <input value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} placeholder="IFSC" maxLength={11} />
          <button className="provider-lime-btn" type="submit" disabled={busy}>Verify account holder</button>
        </form>
      ) : null}
      {bankReady && !payoutReady ? (
        <form className="provider-form" onSubmit={(event) => { event.preventDefault(); void linkRazorpay(); }}>
          <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="PIN code" />
          <button className="provider-lime-btn" type="submit" disabled={busy}>Set up Razorpay account</button>
        </form>
      ) : null}
    </section>
  );
}
