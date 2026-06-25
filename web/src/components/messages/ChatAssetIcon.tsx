export const CHAT_ICON_ASSETS = {
  camera: "/icons/camera.svg",
  mic: "/icons/mic-icon.svg",
  gallery: "/icons/gallery-icon.svg",
  sticker: "/icons/sticker-icon.svg",
  plus: "/icons/plus-icon.svg",
  voiceCall: "/icons/voicecal-icon.svg",
  videoCall: "/icons/videocal-icon.svg"
} as const;

export type ChatIconName = keyof typeof CHAT_ICON_ASSETS;

export function ChatAssetIcon({
  name,
  size = 24,
  alt = ""
}: {
  name: ChatIconName;
  size?: number;
  alt?: string;
}) {
  return (
    <img
      src={CHAT_ICON_ASSETS[name]}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      style={{ display: "block", width: size, height: size, objectFit: "contain" }}
    />
  );
}
