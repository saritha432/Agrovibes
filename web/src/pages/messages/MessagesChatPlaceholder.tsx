export function MessagesChatPlaceholder() {
  return (
    <div className="messages-chat-placeholder">
      <div className="messages-chat-placeholder__icon" aria-hidden>
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="2" opacity="0.25" />
          <path
            d="M32 38c0-8.837 7.163-16 16-16s16 7.163 16 16v4l8 6v14H24V48l8-6v-4z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
      <h2>Your messages</h2>
      <p>Send private photos and messages to a friend or group.</p>
    </div>
  );
}
