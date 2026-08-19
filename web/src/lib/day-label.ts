// Shared "Today / Tomorrow / In N days" urgency label used across the
// admin and student dashboards, so the same date reads the same way
// everywhere in the app.
export function dayLabel(dateStr: string): { text: string; urgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return { text: "Today", urgent: true };
  if (diffDays === 1) return { text: "Tomorrow", urgent: true };
  if (diffDays > 1) return { text: `In ${diffDays} days`, urgent: diffDays <= 3 };
  return { text: "Past", urgent: false };
}
