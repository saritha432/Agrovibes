import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./ContactSupportPage.css";

const FAQ_ITEMS = [
  "Account & payments",
  "Privacy policy",
  "Cancellation policy",
  "How to reset my password?",
  "Do you offer refunds?",
  "Terms and conditions"
] as const;

export function ContactSupportPage() {
  const [query, setQuery] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...FAQ_ITEMS];
    return FAQ_ITEMS.filter((item) => item.toLowerCase().includes(q));
  }, [query]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const subject = encodeURIComponent("Support request from Cropvibe web");
    const body = encodeURIComponent(
      [
        `First Name: ${firstName || "-"}`,
        `Last Name: ${lastName || "-"}`,
        `Company: ${company || "-"}`,
        "",
        message || "-"
      ].join("\n")
    );
    window.location.href = `mailto:info@cropvibe.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="contact-support">
      <section className="contact-support__faq">
        <h1>How we can help you</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for queries"
          aria-label="Search support topics"
        />
        <div className="contact-support__faq-grid">
          {filteredFaq.map((item) => (
            <article className="contact-support__faq-card" key={item}>
              <span className="contact-support__faq-icon">i</span>
              <h2>{item}</h2>
              <p>
                Find quick answers from Cropvibe support. If you need additional help, send us a message below.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-support__reach">
        <div className="contact-support__photo" />
        <form className="contact-support__form" onSubmit={onSubmit}>
          <h2>We&apos;d love to hear from you</h2>
          <p>Contact us regarding any concerns or inquiries.</p>
          <div className="contact-support__row">
            <label>
              First Name
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. June" />
            </label>
            <label>
              Last Name
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Doe" />
            </label>
          </div>
          <label>
            Company
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Company XYZ" />
          </label>
          <label>
            Additional Message
            <textarea
              rows={5}
              maxLength={420}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message here..."
            />
          </label>
          <div className="contact-support__actions">
            <button type="submit">Primary Action</button>
            <span>{message.length}/420</span>
          </div>
        </form>
      </section>
    </div>
  );
}
