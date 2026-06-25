import { createPortal } from "react-dom";
import "./ChatMessageActionSheet.css";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;

type Props = {
  visible: boolean;
  timestampLabel?: string;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onReact: (emoji: string) => void;
};

export function ChatMessageActionSheet({
  visible,
  timestampLabel,
  onClose,
  onReply,
  onCopy,
  onForward,
  onReact
}: Props) {
  if (!visible) return null;

  const run = (fn: () => void) => {
    onClose();
    requestAnimationFrame(fn);
  };

  return createPortal(
    <div className="chat-action-sheet" role="presentation" onClick={onClose}>
      <div
        className="chat-action-sheet__panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-action-sheet__emoji-row">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="chat-action-sheet__emoji-btn"
              onClick={() => run(() => onReact(emoji))}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {timestampLabel ? <p className="chat-action-sheet__timestamp">{timestampLabel}</p> : null}

        <button type="button" className="chat-action-sheet__menu-row" onClick={() => run(onReply)}>
          <span className="chat-action-sheet__menu-icon" aria-hidden>
            ↩
          </span>
          Reply
        </button>

        <button type="button" className="chat-action-sheet__menu-row" onClick={() => run(onCopy)}>
          <span className="chat-action-sheet__menu-icon" aria-hidden>
            ⧉
          </span>
          Copy
        </button>

        <button type="button" className="chat-action-sheet__menu-row" onClick={() => run(onForward)}>
          <span className="chat-action-sheet__menu-icon" aria-hidden>
            ➤
          </span>
          Forward
        </button>
      </div>
    </div>,
    document.body
  );
}
