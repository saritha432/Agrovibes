import { APP_BLACK, APP_LIME, APP_SURFACE } from "./appColors";

/** Dark theme for user search + public profile flows (aligned with app brand). */
export const socialDiscoveryTheme = {
  bg: APP_BLACK,
  surface: APP_SURFACE,
  elevated: APP_SURFACE,
  border: "#3a3a3a",
  text: "#eef5f1",
  muted: "#8aa396",
  accent: APP_LIME,
  accentText: APP_BLACK,
  navBg: APP_BLACK,
  navTint: "#eef5f1",
  rowDivider: "#24302c",
  searchBarBg: "#1c2622",
  avatarRing: "#2a3832",
  statLabel: "#7d948a",
  gridTile: "#1a221f",
  videoPlaceholder: "#2d3d38",
  emptyIcon: "#5c7268"
} as const;
