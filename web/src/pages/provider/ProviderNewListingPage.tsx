import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { fetchProviderKycStatus, submitProviderListing } from "../../api/providerKyc";
import { saveListingImage } from "./listingImages";

const CHANNELS = ["Rental", "Services", "Store", "Educators"] as const;
const CATEGORIES = ["Machinery", "Farm Equipment", "Drivers", "Labor", "Land", "Warehouse", "Drone Spraying", "Soil Testing"];

export function ProviderNewListingPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("Rental");
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const publish = async () => {
    if (!token || title.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const status = await fetchProviderKycStatus(token);
      if (status.status !== "approved") {
        setError("Admin must approve your provider registration before a listing can be submitted.");
        return;
      }
      const created = await submitProviderListing(token, {
        title: title.trim(),
        category,
        channel
      });
      if (photo && created.listing?.id) saveListingImage(created.listing.id, photo);
      navigate(channel === "Services" ? "/provider/services" : "/provider/rental");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The listing was not sent to admin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="provider-panel">
      <h1>New listing</h1>
      <p>Same details as the phone: name, type, channel, and a photo.</p>
      <label>
        Name
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Swaraj 744" />
      </label>
      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        Channel
        <select value={channel} onChange={(event) => setChannel(event.target.value as (typeof CHANNELS)[number])}>
          {CHANNELS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        Photo
        <input type="file" accept="image/*" onChange={(event) => onPhoto(event.target.files?.[0])} />
      </label>
      {photo ? <img className="provider-card__photo" src={photo} alt="" /> : null}
      {error ? <p className="provider-error">{error}</p> : null}
      <button type="button" className="provider-btn" disabled={busy || title.trim().length < 2} onClick={() => void publish()}>
        {busy ? "Submitting…" : "Submit for approval"}
      </button>
    </section>
  );
}
