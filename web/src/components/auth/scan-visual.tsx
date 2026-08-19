"use client";

import { motion, useReducedMotion } from "framer-motion";

// A pass card being scanned: a light beam sweeps down over a barcode pass,
// then a verified checkmark resolves — the actual mechanic this product
// performs at every exam hall door, not a decorative abstraction. Loops
// on a sweep-then-rest rhythm (scan, verify, pause) rather than a
// continuous bounce, so it reads as an event completing, not a spinner.
//
// The card/photo/barcode/brackets are a static SVG (crisp, cheap). The
// beam and checkmark are separate absolutely-positioned motion.divs
// animating transform/opacity — SVG geometry attributes (x/y on <rect>)
// don't drive reliably through Framer Motion's animate(), so the moving
// pieces live outside the SVG entirely rather than as motion.rect/motion.g.
export function ScanVisual() {
  const reduceMotion = useReducedMotion();

  const cycle = reduceMotion
    ? { duration: 2.2, repeat: Infinity }
    : { duration: 3.6, times: [0, 0.06, 0.42, 0.5, 1], repeat: Infinity, ease: "easeInOut" as const };

  const beamAnimate = reduceMotion
    ? { opacity: [0, 1, 0] }
    : { top: ["14%", "14%", "80%", "80%", "14%"], opacity: [0, 1, 1, 0, 0] };

  const checkAnimate = reduceMotion
    ? { opacity: [0, 1, 0], scale: [0.6, 1, 0.6] }
    : { scale: [0, 0, 0, 1, 0], opacity: [0, 0, 0, 1, 0] };
  const checkTimes = reduceMotion ? undefined : [0, 0.42, 0.46, 0.58, 0.86];

  return (
    <div className="relative w-full" style={{ aspectRatio: "260 / 190" }}>
      <svg viewBox="0 0 260 190" className="absolute inset-0 h-full w-full" role="img" aria-label="Animated barcode pass being scanned and verified">
        {/* Viewfinder corner brackets — framing device, static */}
        {[
          "M12 30 V16 a4 4 0 0 1 4-4 H30",
          "M230 12 H246 a4 4 0 0 1 4 4 V30",
          "M12 160 V174 a4 4 0 0 0 4 4 H30",
          "M230 178 H246 a4 4 0 0 0 4-4 V160",
        ].map((d) => (
          <path key={d} d={d} stroke="white" strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" fill="none" />
        ))}

        {/* Pass card */}
        <rect x={30} y={20} width={200} height={140} rx={14} fill="white" fillOpacity={0.06} stroke="white" strokeOpacity={0.22} />

        {/* Photo + identity lines */}
        <circle cx={65} cy={54} r={16} fill="white" fillOpacity={0.16} />
        <rect x={92} y={46} width={78} height={6} rx={3} fill="white" fillOpacity={0.28} />
        <rect x={92} y={58} width={54} height={6} rx={3} fill="white" fillOpacity={0.16} />

        {/* Barcode */}
        {[0, 4, 7, 9, 13, 16, 18, 22, 26, 29, 33, 36, 40, 44, 47, 51, 55, 58, 62, 66, 69, 73, 77, 80, 84, 88, 91, 95].map(
          (x, i) => (
            <rect key={x} x={50 + x} y={92} width={i % 3 === 0 ? 3 : 1.5} height={30} fill="white" fillOpacity={0.55} />
          ),
        )}
      </svg>

      {/* Scan beam overlay */}
      <motion.div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          left: "11.5%",
          width: "77%",
          height: "3px",
          background: "linear-gradient(90deg, transparent, #8FD3FF 50%, transparent)",
          filter: "blur(1.5px) drop-shadow(0 0 6px rgba(143,211,255,0.9))",
        }}
        animate={beamAnimate}
        transition={cycle}
      />

      {/* Verified checkmark badge overlay */}
      <motion.div
        aria-hidden="true"
        className="absolute flex items-center justify-center rounded-full"
        style={{
          left: "71.5%",
          top: "63.5%",
          width: "34px",
          height: "34px",
          background: "#1e8e5a",
        }}
        animate={checkAnimate}
        transition={checkTimes ? { ...cycle, times: checkTimes } : cycle}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <path d="M2 8.5 L6 12.5 L14 3" stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
    </div>
  );
}
