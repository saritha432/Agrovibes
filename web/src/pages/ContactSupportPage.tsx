import { useState } from "react";
import type { ReactNode } from "react";
import type { FormEvent } from "react";
import { sendSupportContact } from "../api/support";
import "./ContactSupportPage.css";

type FaqItem = {
  title: string;
  answer: ReactNode;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    title: "How do I reset my password?",
    answer: (
      <ol>
        <li>Open the Cropvibe app.</li>
        <li>Tap Forgot Password on the login screen.</li>
        <li>Enter your registered email address.</li>
        <li>Follow the instructions sent to your email to create a new password.</li>
      </ol>
    )
  },
  {
    title: "How do I delete my Cropvibe account?",
    answer: (
      <>
        <ol>
          <li>Open the Cropvibe app.</li>
          <li>Go to Profile → Settings → Account Center → Manage account → Delete Account.</li>
          <li>Confirm your decision.</li>
        </ol>
        <p>Your account and associated personal data will be deleted according to our Privacy Policy.</p>
      </>
    )
  },
  {
    title: "What is Cropvibe?",
    answer: (
      <>
        <p>Cropvibe is a farming community platform where users can:</p>
        <ul>
          <li>Share farming videos and posts.</li>
          <li>Connect with other farmers.</li>
          <li>Discover agricultural knowledge.</li>
        </ul>
      </>
    )
  },
  {
    title: "How do I report a problem?",
    answer: (
      <p>
        If you encounter an issue while using Cropvibe, use the contact form on this page or email info@cropvibe.com.
        Please include screenshots and your registered email address so we can assist you more quickly.
      </p>
    )
  },
  {
    title: "Privacy Policy",
    answer: (
      <p>
        Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and
        protect your information.{" "}
        <a href="https://cropvibe.com/privacy-policy" target="_blank" rel="noreferrer">
          https://cropvibe.com/privacy-policy
        </a>
      </p>
    )
  },
  {
    title: "Terms & Conditions",
    answer: (
      <p>
        Please review our Terms &amp; Conditions for platform usage rules, account responsibilities, and policies.{" "}
        <a href="https://cropvibe.com/terms" target="_blank" rel="noreferrer">
          https://cropvibe.com/terms
        </a>
      </p>
    )
  }
];

export function ContactSupportPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitted(false);
    setSubmitError("");
    setSubmitting(true);
    try {
      await sendSupportContact({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim()
      });
      setSubmitted(true);
      setFirstName("");
      setLastName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Could not send your support request.";
      if (messageText.includes("(404)")) {
        const encodedSubject = encodeURIComponent(subject.trim() || "Cropvibe Support");
        const body = encodeURIComponent(
          [
            `First Name: ${firstName.trim() || "-"}`,
            `Last Name: ${lastName.trim() || "-"}`,
            `Email Address: ${email.trim() || "-"}`,
            "",
            "Message:",
            message.trim() || "-"
          ].join("\n")
        );
        window.location.href = `mailto:info@cropvibe.com?subject=${encodedSubject}&body=${body}`;
        setSubmitted(true);
      } else {
        setSubmitError(messageText);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFaq = FAQ_ITEMS;

  return (
    <div className="contact-support">
      <section className="contact-support__header">
        <h1>How we can help you?</h1>
        <p>Cropvibe Support Center</p>
        {/* <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          aria-label="Search support topics"
        /> */}
      </section>

      <section className="contact-support__block">
        <h2>FAQ</h2>
        <div className="contact-support__faq-grid">
          {filteredFaq.map((item) => (
            <article className="contact-support__faq-card" key={item.title}>
              <h3>{item.title}</h3>
              <div className="contact-support__faq-content">{item.answer}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-support__block contact-support__assist">
        <h3>Need immediate assistance?</h3>
        <p>📧 info@cropvibe.com</p>
        <p>🕒 Monday – Saturday</p>
        <p>9:00 AM – 6:00 PM IST</p>
        <p className="contact-support__muted">We typically respond within 24 hours.</p>
      </section>

      <section className="contact-support__reach">
        <div className="contact-support__photo" aria-hidden />
        <div className="contact-support__formWrap">
          <h2>Contact Support</h2>
          <form className="contact-support__form" onSubmit={onSubmit}>
            <div className="contact-support__row">
              <label>
                First Name
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label>
                Last Name
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
            </div>
            <label>
              Email Address *
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                placeholder="example@email.com"
              />
            </label>
            <label>
              Subject *
              <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </label>
            <label>
              Message *
              <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Message"}
            </button>
          </form>
          {submitted ? (
            <p className="contact-support__success">
              ✅ Thank you for contacting Cropvibe Support!
              <br />
              We have received your request and will respond within 24 hours.
            </p>
          ) : null}
          {submitError ? <p className="contact-support__error">⚠️ {submitError}</p> : null}
        </div>
      </section>
    </div>
  );
}
