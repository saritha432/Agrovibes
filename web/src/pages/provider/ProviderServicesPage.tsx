import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { fetchProviderListings, type ProviderListing } from "../../api/providerKyc";
import { listingStatusText } from "./providerStatus";

export function ProviderServicesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ProviderListing[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetchProviderListings(token)
      .then((data) => {
        if (active) setRows((data.listings || []).filter((row) => row.channel === "Services"));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load services.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section className="provider-panel">
      <h1>Services</h1>
      {error ? <p className="provider-error">{error}</p> : null}
      {rows.length === 0 ? <p>Service listings you publish will appear here.</p> : null}
      <div className="provider-list">
        {rows.map((row) => (
          <article key={row.id} className="provider-card">
            <strong>{row.title}</strong>
            <span>{row.category}</span>
            <em>{listingStatusText(row.status)}</em>
          </article>
        ))}
      </div>
      <Link className="provider-btn" to="/provider/listings/new">
        New service listing
      </Link>
    </section>
  );
}
