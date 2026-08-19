"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { setOrganizationSuspended } from "@/app/admin/(protected)/(platform)/organizations/actions";
import { avatarColor, initials } from "@/lib/avatar-color";
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";

export type Org = {
  id: string;
  name: string;
  type: string;
  isSuspended: boolean;
  createdAt: string;
  admins: { fullName: string; email: string }[];
  studentCount: number;
  invigilatorCount: number;
};

type SortKey = "name" | "created" | "students";

const TYPE_LABEL: Record<string, string> = {
  COLLEGE: "College",
  UNIVERSITY: "University",
  SCHOOL: "School",
  OTHER: "Institution",
};

export function OrgList({ orgs }: { orgs: Org[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? orgs.filter((o) => o.name.toLowerCase().includes(q) || TYPE_LABEL[o.type]?.toLowerCase().includes(q))
      : orgs;

    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "students") return b.studentCount - a.studentCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orgs, query, sortKey]);

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organizations…"
            className="w-full min-w-0 rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-surface p-1">
          {([
            ["created", "Newest"],
            ["name", "Name"],
            ["students", "Students"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                sortKey === key ? "bg-white text-accent shadow-sm" : "text-slate hover:text-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center">
          <Building2 className="mx-auto size-8 text-slate" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-slate">
            {orgs.length === 0 ? "No organizations yet — create the first one." : "No organizations match your search."}
          </p>
        </div>
      ) : (
        <LayoutGroup>
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {filtered.map((org) => (
                <OrgRow
                  key={org.id}
                  org={org}
                  expanded={expandedId === org.id}
                  onToggleExpand={() => setExpandedId((cur) => (cur === org.id ? null : org.id))}
                />
              ))}
            </AnimatePresence>
          </ul>
        </LayoutGroup>
      )}
    </div>
  );
}

function OrgRow({ org, expanded, onToggleExpand }: { org: Org; expanded: boolean; onToggleExpand: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggleSuspend() {
    setError(null);
    startTransition(async () => {
      const result = await setOrganizationSuspended(org.id, !org.isSuspended);
      if (result.error) setError(result.error);
    });
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface sm:flex-row sm:items-center sm:gap-4">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: avatarColor(org.name) }}
          >
            {initials(org.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{org.name}</p>
            <p className="truncate text-xs text-slate">
              {TYPE_LABEL[org.type] ?? org.type} · Since {new Date(org.createdAt).toLocaleDateString()}
            </p>
          </div>
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-1 shrink-0 text-slate">
            <ChevronDown className="size-4" strokeWidth={2} />
          </motion.span>
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          <CountBadge icon={UserCog} count={org.admins.length} label="admin" />
          <CountBadge icon={GraduationCap} count={org.studentCount} label="student" />
          <CountBadge icon={ShieldCheck} count={org.invigilatorCount} label="invigilator" />

          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              org.isSuspended ? "bg-alert-tint text-alert" : "bg-verified-tint text-verified"
            }`}
          >
            {org.isSuspended ? <Ban className="size-3.5" strokeWidth={2} /> : <CheckCircle2 className="size-3.5" strokeWidth={2} />}
            {org.isSuspended ? "On hold" : "Active"}
          </span>

          <button
            onClick={handleToggleSuspend}
            disabled={pending}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              org.isSuspended
                ? "border-verified/30 text-verified hover:bg-verified-tint"
                : "border-alert/30 text-alert hover:bg-alert-tint"
            }`}
          >
            {pending ? "Saving…" : org.isSuspended ? "Reinstate" : "Hold"}
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 px-4 pb-3 text-xs text-alert">
          <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 rounded-lg bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate">Admins</p>
              {org.admins.length === 0 ? (
                <p className="mt-1.5 text-sm text-slate">No admins assigned.</p>
              ) : (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {org.admins.map((a) => (
                    <li key={a.email} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold text-charcoal">{a.fullName}</span>
                      <span className="text-slate">{a.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function CountBadge({ icon: Icon, count, label }: { icon: typeof UserCog; count: number; label: string }) {
  return (
    <span
      title={`${count} ${label}${count === 1 ? "" : "s"}`}
      className="flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs font-semibold text-charcoal"
    >
      <Icon className="size-3.5 text-slate" strokeWidth={2} />
      {count}
    </span>
  );
}
