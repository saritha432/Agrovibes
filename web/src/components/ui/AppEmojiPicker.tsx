import { useEffect } from "react";
import { createPortal } from "react-dom";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import "./AppEmojiPicker.css";

type Props = {
  open: boolean;
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  width?: number | string;
  height?: number;
  variant?: "popover" | "overlay";
  closeOnSelect?: boolean;
};

export function AppEmojiPicker({
  open,
  onSelect,
  onClose,
  width = 320,
  height = 380,
  variant = "overlay",
  closeOnSelect = true
}: Props) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const picker = (
    <div
      className={`app-emoji-picker app-emoji-picker--${variant}`}
      role="dialog"
      aria-label="Emoji picker"
      onClick={(event) => event.stopPropagation()}
    >
      {onClose ? (
        <button type="button" className="app-emoji-picker__backdrop" onClick={onClose} aria-label="Close emoji picker" />
      ) : null}
      <div className="app-emoji-picker__panel">
        <EmojiPicker
          theme={Theme.DARK}
          width={width}
          height={height}
          lazyLoadEmojis
          skinTonesDisabled
          previewConfig={{ showPreview: false }}
          onEmojiClick={(emoji: EmojiClickData) => {
            onSelect(emoji.emoji);
            if (closeOnSelect) onClose?.();
          }}
        />
      </div>
    </div>
  );

  if (variant === "overlay" && typeof document !== "undefined") {
    return createPortal(picker, document.body);
  }

  return picker;
}
