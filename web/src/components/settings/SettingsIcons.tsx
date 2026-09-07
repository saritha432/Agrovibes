import type { ReactNode } from "react";

const LIME = "#c9ff35";

type IconProps = { size?: number };

function IconBase({ size = 24, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function SettingsIconPerson({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <circle cx="12" cy="8" r="4" stroke={LIME} strokeWidth="1.8" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke={LIME} strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

export function SettingsIconStore({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <path d="M4 10h16l-1.2-5H5.2L4 10Z" stroke={LIME} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 10v8h12v-8" stroke={LIME} strokeWidth="1.8" />
      <path d="M10 18v-4h4v4" stroke={LIME} strokeWidth="1.8" />
    </IconBase>
  );
}

export function SettingsIconBookmark({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <path d="M7 4h10v16l-5-3-5 3V4Z" stroke={LIME} strokeWidth="1.8" strokeLinejoin="round" />
    </IconBase>
  );
}

export function SettingsIconActivity({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <path d="M4 14l4-4 3 3 5-6 4 4" stroke={LIME} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}

export function SettingsIconBell({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <path d="M12 4a4 4 0 0 0-4 4v2.5L6 13h12l-2-2.5V8a4 4 0 0 0-4-4Z" stroke={LIME} strokeWidth="1.8" />
      <path d="M10 17a2 2 0 0 0 4 0" stroke={LIME} strokeWidth="1.8" />
    </IconBase>
  );
}

export function SettingsIconLock({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <rect x="6" y="10" width="12" height="10" rx="2" stroke={LIME} strokeWidth="1.8" />
      <path d="M9 10V8a3 3 0 0 1 6 0v2" stroke={LIME} strokeWidth="1.8" />
    </IconBase>
  );
}

export function SettingsIconBan({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <circle cx="12" cy="12" r="8" stroke={LIME} strokeWidth="1.8" />
      <path d="M7 7l10 10" stroke={LIME} strokeWidth="1.8" />
    </IconBase>
  );
}

export function SettingsIconLanguage({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <circle cx="12" cy="12" r="8" stroke={LIME} strokeWidth="1.8" />
      <path d="M4 12h16M12 4c2.5 2.5 3.8 5.2 4 8-0.2 2.8-1.5 5.5-4 8-2.5-2.5-3.8-5.2-4-8 0.2-2.8 1.5-5.5 4-8Z" stroke={LIME} strokeWidth="1.8" />
    </IconBase>
  );
}

export function SettingsIconInfo({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <circle cx="12" cy="12" r="8" stroke={LIME} strokeWidth="1.8" />
      <path d="M12 10v6M12 7h.01" stroke={LIME} strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}

export function SettingsIconChevron() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="#97a0a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIconBack() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 6l-6 6 6 6" stroke={LIME} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIconLogout({ size }: IconProps) {
  return (
    <IconBase size={size}>
      <path d="M10 7V6a2 2 0 0 1 2-2h7v16h-7a2 2 0 0 1-2-2v-1" stroke="#ff6b6b" strokeWidth="1.8" />
      <path d="M14 12H4m0 0 3-3M4 12l3 3" stroke="#ff6b6b" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  );
}
