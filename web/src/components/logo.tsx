// Shield-and-checkmark mark — "guard" + "verified", the two things
// ExamGuard actually does. Deep Blue only, no status colors, per the
// UI/UX Brief's "calm authority" / single-accent rule.
function Mark({ size, inverted }: { size: number; inverted?: boolean }) {
  const shield = inverted ? "white" : "#1A3C6E";
  const check = inverted ? "#1A3C6E" : "white";
  return (
    <svg width={size} height={(size * 116) / 100} viewBox="0 0 100 116" fill="none" aria-hidden="true">
      <path
        d="M50 4 C 62 4 72 8 82 13 C 84 14 85 16 85 18 L 85 50 C 85 78 70 98 50 112 C 30 98 15 78 15 50 L 15 18 C 15 16 16 14 18 13 C 28 8 38 4 50 4 Z"
        fill={shield}
      />
      <path
        d="M33 57 L45 69 L69 43"
        stroke={check}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  size = 28,
  withWordmark = true,
  inverted = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Mark size={size} inverted={inverted} />
      {withWordmark && (
        <span
          className="font-bold tracking-tight"
          style={{ fontSize: size * 0.6, color: inverted ? "white" : "#10131A" }}
        >
          Exam<span style={{ color: inverted ? "white" : "#1A3C6E" }}>Guard</span>
        </span>
      )}
    </span>
  );
}
