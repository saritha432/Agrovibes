import React from "react";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  allowMultiple?: boolean;
};

const theme = {
  backdrop: "#00000099",
  knob: "#C9FF35",
  container: "#1c1c1e",
  header: "#f5f5f5",
  skinTonesContainer: "#2c2c2e",
  category: {
    icon: "#C9FF35",
    iconActive: "#111111",
    container: "#2c2c2e",
    containerActive: "#C9FF35"
  },
  search: {
    background: "#2c2c2e",
    text: "#f5f5f5",
    placeholder: "#8e8e93",
    icon: "#C9FF35"
  }
};

export function AppEmojiPicker({ open, onClose, onSelect, allowMultiple = false }: Props) {
  return (
    <EmojiPicker
      open={open}
      onClose={onClose}
      onEmojiSelected={(emoji: EmojiType) => {
        onSelect(emoji.emoji);
        if (!allowMultiple) onClose();
      }}
      enableSearchBar
      enableRecentlyUsed
      categoryPosition="top"
      theme={theme}
      allowMultipleSelections={allowMultiple}
    />
  );
}
