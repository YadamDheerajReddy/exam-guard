import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/admin-context";
import { OrgLogoSettings } from "@/components/admin/org-logo-settings";
import { OrgDetailsSettings } from "@/components/admin/org-details-settings";
import { HallTicketCustomizer } from "@/components/admin/hall-ticket-customizer";
import { ChangeRequestForm } from "@/components/admin/change-request-form";
import { listHallTicketTemplates } from "./actions";
import { listMyChangeRequests } from "./change-request-actions";

export default async function SettingsPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, type, logo_url, address, contact_number, contact_email, hall_ticket_header_text, hall_ticket_footer_note, hall_ticket_letter, hall_ticket_show_address, hall_ticket_primary_color, hall_ticket_font, hall_ticket_border_style, hall_ticket_header_layout, hall_ticket_logo_size, hall_ticket_header_bg_color, hall_ticket_header_bg_gradient_to, hall_ticket_org_name_color, hall_ticket_signature1_url, hall_ticket_signature1_label, hall_ticket_signature2_url, hall_ticket_signature2_label",
    )
    .eq("id", admin.organizationId)
    .maybeSingle();

  const isSchool = org?.type === "SCHOOL";

  // org-logos / hall-ticket-signatures are private buckets with no
  // storage.objects policies (same pattern as student-photos) — signing
  // always goes through the service-role client, never the cookie-scoped one.
  const service = createAdminClient();
  const signedUrl = async (bucket: string, path: string | null | undefined) => {
    if (!path) return null;
    const { data } = await service.storage.from(bucket).createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };

  const [logoUrl, signature1Url, signature2Url, templates, changeRequests] = await Promise.all([
    signedUrl("org-logos", org?.logo_url),
    isSchool ? signedUrl("hall-ticket-signatures", org?.hall_ticket_signature1_url) : Promise.resolve(null),
    isSchool ? signedUrl("hall-ticket-signatures", org?.hall_ticket_signature2_url) : Promise.resolve(null),
    isSchool ? listHallTicketTemplates() : Promise.resolve([]),
    listMyChangeRequests(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-bold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-slate">Organization-wide preferences.</p>

      <div className="mt-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OrgLogoSettings initialSignedUrl={logoUrl} />
          <OrgDetailsSettings
            initialAddress={org?.address ?? ""}
            initialContactNumber={org?.contact_number ?? ""}
            initialContactEmail={org?.contact_email ?? ""}
          />
        </div>

        <ChangeRequestForm initialRequests={changeRequests} />

        {isSchool && (
          <HallTicketCustomizer
            templates={templates}
            initial={{
              orgName: org?.name ?? "ExamGuard",
              orgLogoUrl: logoUrl,
              orgAddress: org?.address ?? "",
              headerText: org?.hall_ticket_header_text ?? "",
              footerNote: org?.hall_ticket_footer_note ?? "",
              letterText: org?.hall_ticket_letter ?? "",
              showAddress: org?.hall_ticket_show_address ?? false,
              primaryColor: org?.hall_ticket_primary_color ?? "",
              font: org?.hall_ticket_font ?? "",
              borderStyle: (org?.hall_ticket_border_style as "solid" | "double" | "dashed" | "none" | null) ?? null,
              headerLayout: (org?.hall_ticket_header_layout as "centered" | "left" | null) ?? null,
              logoSize: org?.hall_ticket_logo_size ?? null,
              headerBgColor: org?.hall_ticket_header_bg_color ?? "",
              headerBgGradientTo: org?.hall_ticket_header_bg_gradient_to ?? "",
              orgNameColor: org?.hall_ticket_org_name_color ?? "",
              signature1Label: org?.hall_ticket_signature1_label ?? "",
              signature1Url,
              signature2Label: org?.hall_ticket_signature2_label ?? "",
              signature2Url,
            }}
          />
        )}
      </div>
    </div>
  );
}
