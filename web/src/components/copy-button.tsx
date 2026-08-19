"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-tint"
      }
    >
      {copied ? <Check className="size-3" strokeWidth={2.5} /> : <Copy className="size-3" strokeWidth={2} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
