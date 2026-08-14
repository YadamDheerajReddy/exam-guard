// Color tokens from the ExamGuard UI/UX Brief (neutral base + single
// institutional accent + reserved status colors). Kept in sync with
// web/src/app/globals.css.
export const Colors = {
  ink: "#10131A",
  charcoal: "#1F2430",
  slate: "#6B7280",
  border: "#D7DEE8",
  surface: "#F4F7FB",
  white: "#FFFFFF",

  accent: "#1A3C6E",
  accentHover: "#14315C",
  accentTint: "#EAF0FB",

  verified: "#1E8E5A",
  verifiedTint: "#E6F6EE",
  alert: "#D93025",
  alertTint: "#FDEAE9",
  pending: "#C77700",
  pendingTint: "#FFF4E0",
  inactive: "#6B7280",
  inactiveTint: "#EEF0F3",
} as const;

export const Radius = 8;
