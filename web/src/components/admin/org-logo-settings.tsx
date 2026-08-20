"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadOrgLogo, removeOrgLogo } from "@/app/admin/(protected)/(org)/settings/actions";
import { AlertCircle, Building2, Trash2, Upload } from "lucide-react";

export function OrgLogoSettings({ initialSignedUrl }: { initialSignedUrl: string | null }) {
  const router = useRouter();
  const [signedUrl, setSignedUrl] = useState(initialSignedUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSelect(file: File) {
    setError(null);
    const formData = new FormData();
    formData.set("logo", file);

    startTransition(async () => {
      const result = await uploadOrgLogo(formData);
      if (result.ok) {
        setSignedUrl(result.signedUrl);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeOrgLogo();
      if (result.error) {
        setError(result.error);
      } else {
        setSignedUrl(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-charcoal">Organization logo</h2>
      <p className="mt-1 text-sm text-slate">
        Shown in the admin console header. School organizations also get it on printed hall tickets.
      </p>

      <div className="mt-4 flex items-center gap-4">
        {signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL
          <img src={signedUrl} alt="" className="h-16 w-16 rounded-lg border border-border object-contain p-1" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-surface">
            <Building2 className="size-6 text-slate" strokeWidth={1.75} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="org-logo-upload"
            className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-charcoal transition-colors hover:bg-surface"
          >
            <Upload className="size-3.5" strokeWidth={2} />
            {pending ? "Uploading…" : signedUrl ? "Replace logo" : "Upload logo"}
          </label>
          <input
            id="org-logo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSelect(file);
              e.target.value = "";
            }}
          />
          {signedUrl && (
            <button
              onClick={handleRemove}
              disabled={pending}
              className="flex w-fit items-center gap-1.5 text-xs font-semibold text-alert disabled:opacity-50"
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
              Remove logo
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-alert-tint px-3 py-2 text-xs text-alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-slate">JPEG, PNG, WebP, or SVG. Up to 2MB.</p>
    </div>
  );
}
