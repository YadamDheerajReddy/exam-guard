"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

export function MobileSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="shrink-0 rounded-lg p-2 text-charcoal transition-colors hover:bg-surface md:hidden"
      >
        <Menu className="size-5" strokeWidth={2} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="animate-in fade-in absolute inset-0 bg-ink/40 duration-200"
            onClick={() => setOpen(false)}
          />
          <div className="animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-white p-4 shadow-lg duration-200">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="mb-4 self-end rounded-lg p-2 text-charcoal transition-colors hover:bg-surface"
            >
              <X className="size-5" strokeWidth={2} />
            </button>
            <div onClick={() => setOpen(false)}>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
