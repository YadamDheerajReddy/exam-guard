"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building, MessageSquare } from "lucide-react";

const links = [
  { href: "/admin/organizations", label: "Organizations", icon: Building },
  { href: "/admin/change-requests", label: "Change Requests", icon: MessageSquare },
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-alert px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function PlatformNav({ changeRequestsCount = 0 }: { changeRequestsCount?: number }) {
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
            {link.href === "/admin/change-requests" && <NavBadge count={changeRequestsCount} />}
          </Link>
        );
      })}
    </nav>
  );
}
