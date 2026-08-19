"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print fixed right-6 top-6 flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-accent-hover"
    >
      <Printer className="size-4" strokeWidth={2} />
      Print
    </button>
  );
}
