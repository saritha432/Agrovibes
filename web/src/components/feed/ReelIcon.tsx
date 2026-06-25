type IconName = "heart" | "heart-filled" | "comment" | "share" | "bookmark" | "more" | "mute" | "unmute" | "thumbs-down" | "thumbs-down-filled";

const PATHS: Record<IconName, string> = {
  heart: "M12.62 20.9c-.34.13-.9.13-1.24 0C8.5 19.8 2 15.7 2 8.75 2 5.68 4.45 3.2 7.48 3.2c1.8 0 3.4.87 4.42 2.22A5.53 5.53 0 0 1 16.32 3.2C19.35 3.2 21.8 5.68 21.8 8.75c0 6.95-6.5 11.05-9.18 12.15Z",
  "heart-filled":
    "M12.62 20.9c-.34.13-.9.13-1.24 0C8.5 19.8 2 15.7 2 8.75 2 5.68 4.45 3.2 7.48 3.2c1.8 0 3.4.87 4.42 2.22A5.53 5.53 0 0 1 16.32 3.2C19.35 3.2 21.8 5.68 21.8 8.75c0 6.95-6.5 11.05-9.18 12.15Z",
  comment: "M8.2 19.2h7.1c3.4 0 5.1-1.7 5.1-5.1V8.8c0-3.4-1.7-5.1-5.1-5.1H8.2c-3.4 0-5.1 1.7-5.1 5.1v5.3c0 3.4 1.7 5.1 5.1 5.1ZM8.7 11.5h6.7",
  share: "m8.1 12 8.5-4.1c.9-.43 1.8.48 1.37 1.37L13.8 17.8c-.42.89-1.68.8-1.98-.14L10.6 13.6 6.5 12.38c-.95-.28-1.02-1.61-.1-1.98L20.72 4.1",
  bookmark: "M6.7 3.2h10.6c1.7 0 2.7 1 2.7 2.7v14.9c0 .83-.94 1.3-1.6.8L12 17.1l-6.4 4.5c-.66.5-1.6.03-1.6-.8V5.9c0-1.7 1-2.7 2.7-2.7Z",
  more: "M5.2 12a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Zm8.5 0a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Zm8.5 0a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z",
  mute: "M4.2 10.2v3.6h2.7l3.4 3.4V6.8L6.9 10.2H4.2Zm11.6 1.8 3 3m0-3-3 3",
  unmute: "M4.2 10.2v3.6h2.7l3.4 3.4V6.8L6.9 10.2H4.2Zm11.4-3.9a5.1 5.1 0 0 1 0 7.8m2.6-10.2a8.5 8.5 0 0 1 0 12.6",
  "thumbs-down": "M6.5 10.5V18c0 .8.7 1.5 1.5 1.5h1.2c.6 0 1.1-.4 1.3-1l1.5-4.5 3.2-1.6c.8-.4 1.3-1.2 1.3-2.1V6.5c0-1.1-.9-2-2-2h-7.5c-.8 0-1.5.6-1.7 1.4L6.5 10.5Z M4 10.5H3c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1h1",
  "thumbs-down-filled": "M6.5 10.5V18c0 .8.7 1.5 1.5 1.5h1.2c.6 0 1.1-.4 1.3-1l1.5-4.5 3.2-1.6c.8-.4 1.3-1.2 1.3-2.1V6.5c0-1.1-.9-2-2-2h-7.5c-.8 0-1.5.6-1.7 1.4L6.5 10.5Z M4 10.5H3c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1h1"
};

export function ReelIcon({
  name,
  size = 22,
  color = "#fff",
  filled = false
}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const iconName =
    name === "heart" && filled
      ? "heart-filled"
      : name === "thumbs-down" && filled
        ? "thumbs-down-filled"
        : name;
  const path = PATHS[iconName];
  const isFilledHeart = iconName === "heart-filled";
  const isFilledThumb = iconName === "thumbs-down-filled";
  const isMore = iconName === "more";
  const isShare = iconName === "share";

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      <path
        d={path}
        fill={isFilledHeart || isFilledThumb || isMore ? color : "none"}
        stroke={isFilledHeart || isFilledThumb || isMore ? "none" : color}
        strokeWidth={isShare ? 1.8 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
