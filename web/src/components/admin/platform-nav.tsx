"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building } from "lucide-react";

const links = [{ href: "/admin/organizations", label: "Organizations", icon: Building }];

export function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname.startsWith(link.href)
                ? "flex items-center gap-2.5 rounded-lg bg-accent-tint px-3 py-2 text-sm font-semibold text-accent"
                : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-surface"
            }
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
