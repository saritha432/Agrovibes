import { requireOptionalNativeModule } from "expo";
import React, { useEffect, useRef } from "react";
import { Platform, View, type StyleProp, type TextInput, type ViewStyle } from "react-native";

type NativePastePayload = { type: "text"; value: string } | { type: "images"; uris: string[] } | { type: "unsupported" };

type NativePasteWrapper = React.ComponentType<{
  style?: StyleProp<ViewStyle>;
  onPaste?: (payload: NativePastePayload) => void;
  children?: React.ReactNode;
}>;

type WebClipboardItem = { kind: string; type: string; getAsFile: () => Blob | null };
type WebPasteEvent = {
  clipboardData?: { items?: ArrayLike<WebClipboardItem> } | null;
  preventDefault: () => void;
};
type WebPasteTarget = {
  addEventListener?: (type: string, listener: (event: WebPasteEvent) => void) => void;
  removeEventListener?: (type: string, listener: (event: WebPasteEvent) => void) => void;
};

let cachedNativeWrapper: NativePasteWrapper | null | undefined;

/** Only mount expo-paste-input when the running binary actually includes it; otherwise the view crashes. */
function getNativePasteWrapper(): NativePasteWrapper | null {
  if (cachedNativeWrapper !== undefined) return cachedNativeWrapper;
  cachedNativeWrapper = null;
  if (Platform.OS === "web") return null;
  try {
    if (requireOptionalNativeModule("ExpoPasteInput")) {
      cachedNativeWrapper = (require("expo-paste-input") as { TextInputWrapper: NativePasteWrapper }).TextInputWrapper;
    }
  } catch {
    cachedNativeWrapper = null;
  }
  return cachedNativeWrapper;
}

type Props = {
  inputRef: React.RefObject<TextInput | null>;
  onPasteImages: (uris: string[]) => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactElement;
};

export function ComposerPasteBoundary({ inputRef, onPasteImages, style, children }: Props) {
  const onPasteImagesRef = useRef(onPasteImages);
  onPasteImagesRef.current = onPasteImages;

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = inputRef.current as unknown as WebPasteTarget | null;
    if (!node?.addEventListener) return;
    const handler = (event: WebPasteEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const uris: string[] = [];
      for (const item of items) {
        if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) uris.push(URL.createObjectURL(file));
      }
      if (!uris.length) return;
      event.preventDefault();
      onPasteImagesRef.current(uris);
    };
    node.addEventListener("paste", handler);
    return () => node.removeEventListener?.("paste", handler);
  }, [inputRef]);

  const NativeWrapper = getNativePasteWrapper();
  if (NativeWrapper) {
    return (
      <NativeWrapper
        style={style}
        onPaste={(payload) => {
          if (payload.type === "images" && payload.uris.length) onPasteImagesRef.current(payload.uris);
        }}
      >
        {children}
      </NativeWrapper>
    );
  }
  return <View style={style}>{children}</View>;
}
