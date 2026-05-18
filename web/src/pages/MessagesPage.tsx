import { Outlet, useParams } from "react-router-dom";
import { MessagesInbox } from "./messages/MessagesInbox";
import "./MessagesPage.css";

export function MessagesPage() {
  const { peerUserId } = useParams();
  const chatOpen = Boolean(peerUserId);

  return (
    <div className={`messages-page${chatOpen ? " messages-page--chat-open" : ""}`}>
      <aside className="messages-page__inbox">
        <header className="messages-page__head">
          <h1>Messages</h1>
        </header>
        <MessagesInbox />
      </aside>
      <section className="messages-page__chat">
        <Outlet />
      </section>
    </div>
  );
}
