"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/roster", label: "Roster Upload" },
  { href: "/admin/halls", label: "Halls" },
  { href: "/admin/exams", label: "Exams" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "rounded-lg bg-accent-tint px-3 py-2 text-sm font-semibold text-accent"
                : "rounded-lg px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-surface"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
