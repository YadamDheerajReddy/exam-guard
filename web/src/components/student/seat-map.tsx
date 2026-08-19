"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { computeSeatMap } from "@/lib/seat-map";
import { AlertTriangle, ChevronDown, LayoutGrid } from "lucide-react";

// This is a schematic guess from the seat number and hall capacity alone —
// there's no stored physical layout to draw from (see lib/seat-map.ts) — so
// it can be wrong about row shape, aisles, or exact position. It exists to
// give a rough sense of where to look, never to replace the invigilator's
// actual seat check at the door.
export function SeatMap({ seatNumber, capacity }: { seatNumber: string; capacity: number }) {
  const [open, setOpen] = useState(false);
  const map = computeSeatMap(seatNumber, capacity);

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-verified underline decoration-verified/40 underline-offset-2"
      >
        <LayoutGrid className="size-3.5" strokeWidth={2} />
        {open ? "Hide seat map" : "View seat map"}
        <span className="rounded-full bg-verified/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
          Beta
        </span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-verified/20 bg-white p-4">
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-pending" strokeWidth={2} />
                Approximate only — not the hall&apos;s real layout. Always confirm your seat with the invigilator
                at the door.
              </p>

              {map.kind === "unavailable" ? (
                <p className="mt-3 text-center text-sm text-slate">
                  A layout preview isn&apos;t available for seat <span className="font-mono">{seatNumber}</span>.
                </p>
              ) : (
                <div className="mt-3 flex flex-col items-center gap-2">
                  {map.windowStart > 0 && <p className="text-[10px] text-slate">⋯ earlier rows</p>}
                  {Array.from({ length: map.windowEnd - map.windowStart + 1 }, (_, i) => map.windowStart + i).map(
                    (row) => (
                      <div key={row} className="flex items-center gap-1.5">
                        <span className="w-5 shrink-0 text-right text-[10px] font-semibold text-slate">
                          {map.rowLabel(row)}
                        </span>
                        <div className="flex gap-1">
                          {Array.from({ length: map.cols }, (_, col) => {
                            const isSeat = row === map.seatRow && col === map.seatCol;
                            return (
                              <div
                                key={col}
                                className={`size-4 rounded-sm ${
                                  isSeat ? "bg-verified" : "border border-border bg-surface"
                                }`}
                                title={isSeat ? `Your seat · ${seatNumber}` : undefined}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ),
                  )}
                  {map.windowEnd < map.totalRows - 1 && <p className="text-[10px] text-slate">⋯ later rows</p>}
                  <p className="mt-1 text-[10px] text-slate">
                    Row {map.rowLabel(map.seatRow)}, seat {seatNumber} · schematic of ~{capacity} seats
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
