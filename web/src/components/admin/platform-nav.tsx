"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [{ href: "/admin/organizations", label: "Organizations" }];

export function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            pathname.startsWith(link.href)
              ? "rounded-lg bg-accent-tint px-3 py-2 text-sm font-semibold text-accent"
              : "rounded-lg px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-surface"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
