// Deterministic per-org accent for the dashboard's avatar chips — same
// name always resolves to the same color, no client-side randomness or
// stored color column needed. Palette stays inside the app's institutional
// blue family plus a few muted, on-brand alternates rather than a full
// rainbow, so a page full of orgs doesn't read as confetti.
const PALETTE = ["#1a3c6e", "#0f6e5c", "#8a4b0f", "#5b3ba0", "#0e6ba8", "#9c3d54", "#3d6e1a", "#6e3d1a"];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
