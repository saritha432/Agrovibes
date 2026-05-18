import type { GalleryTab } from "../../pages/profileUtils";

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  "aria-hidden": true as const
};

function IconGrid() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </svg>
  );
}

function IconReels() {
  return (
    <svg {...iconProps}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSaved() {
  return (
    <svg {...iconProps}>
      <path d="M6 4h12v16l-6-4-6 4V4z" strokeLinejoin="round" />
    </svg>
  );
}

function IconTagged() {
  return (
    <svg {...iconProps}>
      <path d="M4 4h12v12l-4-4H4V4z" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ProfileGalleryIcon({ tab }: { tab: GalleryTab }) {
  switch (tab) {
    case "Posts":
      return <IconGrid />;
    case "Reels":
      return <IconReels />;
    case "Saved":
      return <IconSaved />;
    case "Tagged":
      return <IconTagged />;
    default:
      return <IconGrid />;
  }
}

export const PROFILE_GALLERY_TABS: GalleryTab[] = ["Posts", "Reels", "Saved", "Tagged"];
