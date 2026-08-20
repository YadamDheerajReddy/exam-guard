"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Users,
  Building2,
  CalendarDays,
  ShieldCheck,
  Radio,
  ScrollText,
  FileLock2,
  Settings,
  type LucideIcon,
} from "lucide-react";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/roster", label: "Roster Upload", icon: Upload },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/halls", label: "Halls", icon: Building2 },
  { href: "/admin/exams", label: "Exams", icon: CalendarDays },
  { href: "/admin/invigilators", label: "Invigilators", icon: ShieldCheck },
  { href: "/admin/attendance", label: "Live Attendance", icon: Radio },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/data-requests", label: "Data Requests", icon: FileLock2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-alert px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminNav({ dataRequestsCount = 0 }: { dataRequestsCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "flex items-center gap-2.5 rounded-lg bg-accent-tint px-3 py-2 text-sm font-semibold text-accent"
                : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-surface"
            }
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{link.label}</span>
            {link.href === "/admin/data-requests" && <NavBadge count={dataRequestsCount} />}
          </Link>
        );
      })}
    </nav>
  );
}
