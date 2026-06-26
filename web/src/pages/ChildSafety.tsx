import "./PrivacyPolicy.css";

export function ChildSafety() {
  return (
    <div className="privacy-policy">
      <header className="privacy-policy__header">
        <h1>CropVibe Child Safety Standards</h1>
        <p>
          <strong>Effective Date:</strong> June 2026
        </p>
      </header>

      <section>
        <p>
          CropVibe is committed to maintaining a safe and respectful community for all users. We have zero tolerance
          for Child Sexual Abuse and Exploitation (CSAE) and any content or behavior that exploits, endangers, or
          harms children.
        </p>
      </section>

      <section>
        <h2>Our Standards</h2>
        <ul>
          <li>Child Sexual Abuse Material (CSAM) is strictly prohibited.</li>
          <li>Sexual exploitation or grooming of minors is prohibited.</li>
          <li>Content that endangers or exploits children is prohibited.</li>
          <li>Any illegal activity involving minors is prohibited.</li>
        </ul>
      </section>

      <section>
        <h2>Reporting</h2>
        <p>
          Users can report inappropriate posts and other content directly from the app using the <strong>Report</strong>{" "}
          option. Every report is reviewed by our moderation team.
        </p>
      </section>

      <section>
        <h2>Enforcement</h2>
        <p>If content or accounts violate our policies, CropVibe may:</p>
        <ul>
          <li>Remove the violating content.</li>
          <li>Suspend or permanently terminate user accounts.</li>
          <li>Restrict access to platform features.</li>
          <li>Preserve evidence when legally required.</li>
        </ul>
      </section>

      <section>
        <h2>Cooperation with Authorities</h2>
        <p>
          CropVibe complies with applicable child safety laws and cooperates with law enforcement authorities regarding
          reports involving child exploitation where legally required.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>If you have concerns regarding child safety, please contact:</p>
        <p>
          <strong>Email:</strong> <a href="mailto:info@cropvibe.com">info@cropvibe.com</a>
        </p>
        <p>
          See also our <a href="/privacy-policy">Privacy Policy</a>.
        </p>
      </section>
    </div>
  );
}
