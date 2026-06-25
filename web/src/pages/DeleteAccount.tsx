import "./PrivacyPolicy.css";

export function DeleteAccount() {
  return (
    <div className="privacy-policy">
      <header className="privacy-policy__header">
        <h1>CropVibe Account Deletion</h1>
        <p>
          <strong>Effective Date:</strong> June 22, 2026
        </p>
        <p>
          <strong>Last Updated:</strong> June 24, 2026
        </p>
      </header>

      <section>
        <h2>1. Overview</h2>
        <p>
          Users may request deletion of their CropVibe account through the CropVibe mobile application or by
          contacting CropVibe Support.
        </p>
        <p>
          This page explains how account deletion works, what data is removed, what may be retained, and how to
          contact us if you need help.
        </p>
      </section>

      <section>
        <h2>2. How to Delete Your Account</h2>
        <p>You can request account deletion directly in the CropVibe app:</p>
        <p>
          <strong>Settings → Account → Delete Account</strong>
        </p>
        <p>When a deletion request is submitted:</p>
        <ul>
          <li>Users may be asked to provide a reason for deletion</li>
          <li>Verification may be performed through the registered mobile number or email address</li>
          <li>Confirmation may be sent through email or SMS</li>
          <li>Requests may take up to 7 business days to process</li>
        </ul>
      </section>

      <section>
        <h2>3. Data That Will Be Deleted</h2>
        <p>Upon account deletion, the following data may be permanently removed:</p>
        <ul>
          <li>Profile information</li>
          <li>Username and account details</li>
          <li>Posts</li>
          <li>Reels</li>
          <li>Images and videos uploaded by the account</li>
          <li>Comments</li>
          <li>Likes and interactions associated with the account</li>
          <li>Other content associated with the account</li>
        </ul>
      </section>

      <section>
        <h2>4. Data That May Be Retained</h2>
        <p>
          Certain information may be retained where required for legal, regulatory, fraud prevention, security, or
          compliance purposes, including:
        </p>
        <ul>
          <li>Legal obligations</li>
          <li>Regulatory compliance</li>
          <li>Fraud prevention</li>
          <li>Security purposes</li>
          <li>Dispute resolution</li>
          <li>Other legitimate compliance requirements</li>
        </ul>
        <p>
          When retention is no longer required, retained information will be securely deleted, anonymized, or
          otherwise disposed of in accordance with applicable laws.
        </p>
      </section>

      <section>
        <h2>5. Processing Time</h2>
        <p>
          Account deletion requests are typically processed within <strong>7 business days</strong> after verification
          is completed.
        </p>
        <p>
          You may receive a confirmation message by email or SMS once your request has been received and when deletion
          is completed.
        </p>
      </section>

      <section>
        <h2>6. Important Notes</h2>
        <ul>
          <li>Account deletion is permanent and cannot be undone once processing is complete.</li>
          <li>You will lose access to your profile, posts, reels, followers, and other account data.</li>
          <li>Content visible to other users may be removed from the platform after deletion is processed.</li>
          <li>
            If you only want to stop using CropVibe temporarily, you may log out instead of deleting your account.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Contact CropVibe Support</h2>
        <p>
          If you are unable to delete your account from the app, or if you have questions about account deletion,
          please contact us:
        </p>
        <p>
          <strong>CropVibe Support</strong>
          <br />
          Email: <a href="mailto:info@cropvibe.com">info@cropvibe.com</a>
          <br />
          Website: <a href="https://cropvibe.com" target="_blank" rel="noopener noreferrer">https://cropvibe.com</a>
          <br />
          Address: Andhra Pradesh, India
        </p>
        <p>
          For more information about how we handle personal data, please see our{" "}
          <a href="/privacy-policy">Privacy Policy</a>.
        </p>
      </section>

      <footer className="privacy-policy__footer">
        <p>
          By submitting an account deletion request, you acknowledge that your account and associated content may be
          permanently removed in accordance with this policy.
        </p>
      </footer>
    </div>
  );
}
