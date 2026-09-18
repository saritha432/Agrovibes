import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppEmojiPicker } from "../ui/AppEmojiPicker";
import "./ChatMessageActionSheet.css";

const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;

type Props = {
  visible: boolean;
  timestampLabel?: string;
  activeEmoji?: string | null;
  showDeleteForMe?: boolean;
  showDeleteForEveryone?: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
  onReact: (emoji: string) => void;
};

export function ChatMessageActionSheet({
  visible,
  timestampLabel,
  activeEmoji,
  showDeleteForMe = false,
  showDeleteForEveryone = false,
  onClose,
  onReply,
  onCopy,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) setPickerOpen(false);
  }, [visible]);

  if (!visible) return null;

  const run = (fn: () => void) => {
    setPickerOpen(false);
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
              className={`chat-action-sheet__emoji-btn${activeEmoji === emoji ? " chat-action-sheet__emoji-btn--on" : ""}`}
              onClick={() => run(() => onReact(emoji))}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="chat-action-sheet__emoji-btn chat-action-sheet__emoji-btn--more"
            onClick={() => setPickerOpen(true)}
            aria-label="More emojis"
          >
            +
          </button>
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

        {showDeleteForMe && onDeleteForMe ? (
          <button
            type="button"
            className="chat-action-sheet__menu-row chat-action-sheet__menu-row--danger"
            onClick={() => run(onDeleteForMe)}
          >
            <span className="chat-action-sheet__menu-icon" aria-hidden>
              ⊘
            </span>
            Delete for Me
          </button>
        ) : null}

        {showDeleteForEveryone && onDeleteForEveryone ? (
          <button
            type="button"
            className="chat-action-sheet__menu-row chat-action-sheet__menu-row--danger"
            onClick={() => run(onDeleteForEveryone)}
          >
            <span className="chat-action-sheet__menu-icon" aria-hidden>
              🗑
            </span>
            Delete for Everyone
          </button>
        ) : null}
      </div>
      <AppEmojiPicker
        open={pickerOpen}
        variant="overlay"
        onClose={() => setPickerOpen(false)}
        onSelect={(emoji) => run(() => onReact(emoji))}
      />
    </div>,
    document.body
  );
}
