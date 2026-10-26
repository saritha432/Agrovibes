import { Link } from "react-router-dom";

export function ProviderProfilePage() {
  return (
    <section className="provider-panel">
      <h1>Provider Profile</h1>
      <p>Manage your business account and switch back to the feed.</p>
      <Link className="provider-card provider-card--link" to="/">
        <strong>Switch to Cropvibe Feed</strong>
        <span>Go back to the farmer home.</span>
      </Link>
      <Link className="provider-card provider-card--link" to="/provider/join">
        <strong>Registration</strong>
        <span>Review identity details or check approval.</span>
      </Link>
    </section>
  );
}
