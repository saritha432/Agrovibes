import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  fetchProviderBookings,
  fetchProviderKycStatus,
  fetchProviderListings,
  type ProviderBooking,
  type ProviderListing
} from "../../api/providerKyc";
import { listingImage } from "./listingImages";
import { listingStatusText } from "./providerStatus";

type Tab = "inventory" | "bookings" | "payments" | "reports";

export function ProviderRentalPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("inventory");
  const [listings, setListings] = useState<ProviderListing[]>([]);
  const [bookings, setBookings] = useState<ProviderBooking[]>([]);
  const [status, setStatus] = useState("not_submitted");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const [kyc, listed, booked] = await Promise.all([
          fetchProviderKycStatus(token),
          fetchProviderListings(token),
          fetchProviderBookings(token)
        ]);
        if (!active) return;
        setStatus(kyc.status);
        setListings((listed.listings || []).filter((row) => row.channel !== "Services" && row.channel !== "Educators"));
        setBookings(booked.bookings || []);
        setError("");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load rentals.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section className="provider-panel">
      <div className="provider-subtabs" role="tablist">
        {(
          [
            ["inventory", "Inventory"],
            ["bookings", "Bookings"],
            ["payments", "Payments"],
            ["reports", "Reports"]
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="provider-error">{error}</p> : null}
      {status !== "approved" ? (
        <p className="provider-note">Registration is {status.replace(/_/g, " ")}. Listings go live after admin approval.</p>
      ) : null}

      {tab === "inventory" ? (
        listings.length === 0 ? (
          <p>Your rental listings will appear here after you publish one.</p>
        ) : (
          <div className="provider-list">
            {listings.map((row) => {
              const photo = listingImage(row.id);
              return (
                <article key={row.id} className="provider-card">
                  {photo ? <img className="provider-card__photo" src={photo} alt="" /> : <div className="provider-card__photo provider-card__photo--empty" />}
                  <strong>{row.title}</strong>
                  <span>
                    {row.category} · {row.channel}
                  </span>
                  <em>{listingStatusText(row.status)}</em>
                </article>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "bookings" ? (
        bookings.length === 0 ? (
          <p>Customer bookings will appear here.</p>
        ) : (
          <div className="provider-list">
            {bookings.map((row) => (
              <article key={row.id} className="provider-card">
                <strong>{row.title}</strong>
                <span>
                  {row.customerName || "Customer"}
                  {row.customerPhone ? ` · ${row.customerPhone}` : ""}
                </span>
                <span>
                  {row.date || "Date not set"} · {row.location || "Location not set"}
                </span>
                {row.note ? <span>{row.note}</span> : null}
                <em>Pending</em>
              </article>
            ))}
          </div>
        )
      ) : null}

      {tab === "payments" ? <p>Earnings and payout history will appear here.</p> : null}
      {tab === "reports" ? <p>Performance and rental reports will appear here.</p> : null}
    </section>
  );
}
