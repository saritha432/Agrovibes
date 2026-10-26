import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { fetchProviderKycStatus, fetchProviderListings, type ProviderListing } from "../../api/providerKyc";
import { listingImage } from "./listingImages";
import { listingStatusText } from "./providerStatus";

export function ProviderListingsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ProviderListing[]>([]);
  const [status, setStatus] = useState("not_submitted");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const [kyc, listed] = await Promise.all([fetchProviderKycStatus(token), fetchProviderListings(token)]);
        if (!active) return;
        setStatus(kyc.status);
        setRows(listed.listings || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load listings.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section className="provider-panel">
      <h1>Your listings</h1>
      <p>Create a rental, service, store, or educator listing.</p>
      {status !== "approved" ? (
        <p className="provider-note">
          {status === "rejected"
            ? "Admin rejected your KYC. Verify Aadhaar again. A business also needs PAN or GST."
            : "Admin review is required before your listings go live to customers."}
        </p>
      ) : null}
      {error ? <p className="provider-error">{error}</p> : null}
      <div className="provider-list">
        {rows.map((row) => {
          const photo = listingImage(row.id);
          return (
            <article key={row.id} className="provider-card">
              {photo ? <img className="provider-card__photo" src={photo} alt="" /> : null}
              <strong>{row.title}</strong>
              <span>
                {row.category} · {row.channel}
              </span>
              <em>{listingStatusText(row.status)}</em>
            </article>
          );
        })}
      </div>
      <Link className="provider-btn" to="/provider/listings/new">
        New Listing
      </Link>
    </section>
  );
}
