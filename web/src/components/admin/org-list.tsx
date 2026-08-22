"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  setOrganizationSuspended,
  addOrgAdmin,
  updateOrganizationDetails,
  deleteOrgAdmin,
  resetOrgAdminPassword,
  deleteOrganization,
} from "@/app/admin/(protected)/(platform)/organizations/actions";
import { MAX_ADMINS_PER_ORG } from "@/lib/admin-capacity";
import { avatarColor, initials } from "@/lib/avatar-color";
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";

export type Org = {
  id: string;
  name: string;
  type: string;
  slug: string | null;
  isSuspended: boolean;
  createdAt: string;
  admins: { id: string; fullName: string; email: string; role: string }[];
  studentCount: number;
  invigilatorCount: number;
};

const ADMIN_ROLE_LABEL: Record<string, string> = {
  EXAM_STAFF: "Exam Staff",
  AUDITOR: "Auditor",
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
            <div className="mx-4 mb-4 flex flex-col gap-4">
              <div className="rounded-lg bg-surface p-4">
                <OrgDetailsEditor organizationId={org.id} name={org.name} slug={org.slug} />
              </div>

              <div className="rounded-lg bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate">
                  Admins ({org.admins.length}/{MAX_ADMINS_PER_ORG})
                </p>
                {org.admins.length === 0 ? (
                  <p className="mt-1.5 text-sm text-slate">No admins assigned.</p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {org.admins.map((a) => (
                      <AdminRow key={a.id} organizationId={org.id} admin={a} canDelete={org.admins.length > 1} />
                    ))}
                  </ul>
                )}

                <AddAdminForm organizationId={org.id} atCapacity={org.admins.length >= MAX_ADMINS_PER_ORG} />
              </div>

              <div className="rounded-lg border border-alert/30 bg-alert-tint/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-alert">Danger zone</p>
                <DeleteOrgSection organizationId={org.id} orgName={org.name} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function OrgDetailsEditor({ organizationId, name, slug }: { organizationId: string; name: string; slug: string | null }) {
  const [open, setOpen] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [slugInput, setSlugInput] = useState(slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    if (!nameInput.trim()) {
      setError("Organization name is required.");
      return;
    }
    const formData = new FormData();
    formData.set("name", nameInput.trim());
    formData.set("slug", slugInput.trim());

    startTransition(async () => {
      const result = await updateOrganizationDetails(organizationId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNotice(
        result.migratedStudents
          ? `Saved — updated the login email for ${result.migratedStudents} student${result.migratedStudents === 1 ? "" : "s"}.`
          : "Saved.",
      );
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold text-charcoal">{name}</span>
          <span className="ml-2 text-xs text-slate">
            Organization ID: <span className="font-mono">{slug ?? "not set"}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {notice && <span className="text-xs font-semibold text-verified">{notice}</span>}
          <button
            type="button"
            onClick={() => {
              setNameInput(name);
              setSlugInput(slug ?? "");
              setNotice(null);
              setOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1 text-xs text-slate">
          Name
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </label>
        <label className="flex-1 text-xs text-slate">
          Organization ID
          <input
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="e.g. crimson-hyderabad"
            className="mt-1 w-full rounded-lg border border-border px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
          />
        </label>
      </div>
      <p className="text-xs text-slate">
        Changing the Organization ID automatically updates every existing student&apos;s login so they aren&apos;t
        locked out.
      </p>
      {error && <p className="text-xs text-alert">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate">
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeleteOrgSection({ organizationId, orgName }: { organizationId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrganization(organizationId, confirmText);
      if (result.error) {
        setError(result.error);
        return;
      }
      // The org row unmounts on its own once revalidation removes it from
      // the parent's list — nothing else to clean up here.
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-alert hover:opacity-80"
      >
        <Trash2 className="size-3.5" strokeWidth={2} />
        Delete organization
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <p className="text-xs text-alert">
        This permanently deletes <span className="font-semibold">{orgName}</span> — every admin, student,
        invigilator, hall, exam, and scan record. This cannot be undone.
      </p>
      <p className="text-xs text-charcoal">
        Type <span className="font-mono font-semibold">{orgName}</span> to confirm.
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-alert focus:ring-2 focus:ring-alert/30"
      />
      {error && <p className="text-xs text-alert">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending || confirmText !== orgName}
          className="rounded-lg bg-alert px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError(null);
          }}
          className="text-xs font-semibold text-slate"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AdminRow({
  organizationId,
  admin,
  canDelete,
}: {
  organizationId: string;
  admin: { id: string; fullName: string; email: string; role: string };
  canDelete: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetOrgAdminPassword(organizationId, admin.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResetDone(true);
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrgAdmin(organizationId, admin.id);
      if (result.error) {
        setError(result.error);
        setConfirmingDelete(false);
        return;
      }
      setDeleted(true);
    });
  }

  if (deleted) return null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-charcoal">{admin.fullName}</span>
        <span className="text-slate">{admin.email}</span>
        <span className="text-xs text-slate">· {ADMIN_ROLE_LABEL[admin.role] ?? admin.role}</span>
        {error && <span className="text-xs text-alert">{error}</span>}
      </div>
      <div className="flex items-center gap-3">
        {resetDone ? (
          <span className="text-xs font-semibold text-verified">Reset email sent.</span>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover disabled:opacity-60"
          >
            <KeyRound className="size-3.5" strokeWidth={2} />
            Reset password
          </button>
        )}
        {canDelete &&
          (confirmingDelete ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-slate">Delete?</span>
              <button type="button" onClick={handleDelete} disabled={pending} className="font-semibold text-alert disabled:opacity-60">
                {pending ? "Deleting…" : "Yes"}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="font-semibold text-slate">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 text-xs font-semibold text-alert hover:opacity-80"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
              Delete
            </button>
          ))}
      </div>
    </li>
  );
}

function AddAdminForm({ organizationId, atCapacity }: { organizationId: string; atCapacity: boolean }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EXAM_STAFF");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (atCapacity) {
    return <p className="mt-3 text-xs text-slate">This organization has reached the maximum of {MAX_ADMINS_PER_ORG} admins.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover"
      >
        <UserPlus className="size-3.5" strokeWidth={2} />
        Add admin
      </button>
    );
  }

  function handleSubmit() {
    setError(null);
    if (!fullName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    const formData = new FormData();
    formData.set("fullName", fullName.trim());
    formData.set("email", email.trim());
    formData.set("role", role);

    startTransition(async () => {
      const result = await addOrgAdmin(organizationId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFullName("");
      setEmail("");
      setRole("EXAM_STAFF");
      setDone(true);
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint"
        >
          <option value="EXAM_STAFF">Exam Staff</option>
          <option value="AUDITOR">Auditor</option>
        </select>
      </div>
      {error && <p className="text-xs text-alert">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add admin"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs font-semibold text-slate"
        >
          Cancel
        </button>
        {done && <span className="text-xs font-semibold text-verified">Admin added.</span>}
      </div>
    </div>
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
